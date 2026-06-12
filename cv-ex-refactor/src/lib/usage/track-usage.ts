import { kv, kvAvailable } from '@/lib/quota/kv-client';
import { microUsdCost } from '@/lib/llm/model-prices';
import { maybeFireAlerts } from './alert-webhook';

export type UsageAction =
  | 'analyze'
  | 'generate-cv'
  | 'generate-cover-letter'
  | 'extract-must-haves'
  | 'career-path'
  | 'career-path-suggest'
  | 'job-recommend'
  | 'jd-insights'
  // company-enrich — fires when a user opens a Job Fit detail and the
  // Company Tier-2 enrichment cache is missing/stale. Grounded-search
  // Gemini call (~4k output tokens, ~$0.005/call shared key). Tracked
  // separately from analyze so per-user reports surface enrichment cost
  // and cost buckets stay independent for kill-switch tuning.
  | 'company-enrich'
  // Interview Practice — two LLM calls per session. interview-gen produces
  // 10 questions + Dual Lens (single Gemini/Anthropic call ~6-8k output
  // tokens). interview-grade is the batched grading call after the user
  // submits all 10 answers (~3-4k output tokens). Tracked separately so
  // admin can see gen-to-grade conversion and per-user cost split.
  | 'interview-gen'
  | 'interview-grade';
export type UsageStatus = 'ok' | 'error';

/**
 * Sub-action tag for /api/analyze. v2 = legacy CV-vs-JD (JD Matching page);
 * v3 = CV-Solo Analyze (default `/analyze`). Both paths share the same quota,
 * cost-bucket, and primary counter (`usage:global:<ymd>:analyze:<status>`),
 * but writes ALSO go to `usage:global:<ymd>:analyze-<variant>:<status>` so
 * admin can see the JD Matching vs CV-Solo activation split.
 */
export type AnalyzeVariant = 'v2' | 'v3';

export interface TrackUsageInput {
  action: UsageAction;
  status: UsageStatus;
  byok: boolean;
  userId?: string | undefined;
  variant?: AnalyzeVariant | undefined;
  model?: string | undefined;
  inputChars?: number | undefined;
  outputChars?: number | undefined;
  promptTokens?: number | undefined;
  completionTokens?: number | undefined;
}

// 13 months — covers a full year + grace for retrospective look-back.
const TTL_SECONDS = 13 * 30 * 86400;

function ymOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function ymdOf(d: Date): string {
  return `${ymOf(d)}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function incrWithTtl(key: string, by: number): Promise<number> {
  const next = by === 1 ? await kv.incr(key) : await kv.incrby(key, by);
  if (next === by) {
    // Just-created key (counter started at this value). Set retention.
    await kv.expire(key, TTL_SECONDS);
  }
  return next;
}

/**
 * Fire-and-forget usage tracking. Fail-open on KV outage — never throw.
 *
 * Writes per-user monthly, anonymous BYOK monthly, and daily global counters.
 * All keys carry TTL=13mo to bound KV storage growth.
 */
export async function trackUsage(input: TrackUsageInput): Promise<void> {
  if (!kvAvailable) return;

  const now = new Date();
  const ym = ymOf(now);
  const ymd = ymdOf(now);
  const charVolume = (input.inputChars ?? 0) + (input.outputChars ?? 0);
  const promptTokens = input.promptTokens ?? 0;
  const completionTokens = input.completionTokens ?? 0;
  const tokenVolume = promptTokens + completionTokens;
  const cost = input.model ? microUsdCost(input.model, promptTokens, completionTokens) : 0;

  try {
    const ops: Promise<unknown>[] = [];

    if (input.userId) {
      ops.push(incrWithTtl(`usage:user:${input.userId}:${ym}:${input.action}`, 1));
      if (charVolume > 0) {
        ops.push(incrWithTtl(`usage:user:${input.userId}:${ym}:${input.action}:chars`, charVolume));
      }
      if (tokenVolume > 0) {
        ops.push(incrWithTtl(`usage:user:${input.userId}:${ym}:${input.action}:tokens`, tokenVolume));
      }
      if (cost > 0) {
        ops.push(incrWithTtl(`usage:user:${input.userId}:${ym}:${input.action}:cost-muusd`, cost));
      }
      ops.push(incrWithTtl(`usage:user:${input.userId}:${ym}:${input.byok ? 'byok' : 'shared'}`, 1));
      ops.push(
        kv.sadd(`usage:users:${ym}`, input.userId).then(() =>
          kv.expire(`usage:users:${ym}`, TTL_SECONDS),
        ),
      );
    } else if (input.byok) {
      ops.push(incrWithTtl(`usage:byok-anon:${ym}:${input.action}`, 1));
    }

    ops.push(incrWithTtl(`usage:global:${ymd}:${input.action}:${input.status}`, 1));
    if (charVolume > 0) {
      ops.push(incrWithTtl(`usage:global:${ymd}:${input.action}:chars`, charVolume));
    }
    if (tokenVolume > 0) {
      ops.push(incrWithTtl(`usage:global:${ymd}:${input.action}:tokens`, tokenVolume));
    }

    // Activation tracking — anon shared-key counter for funnel conversion view.
    // signed-in count is derived as (total - anon) so we don't write a second key.
    const isAnonShared = !input.userId && !input.byok;
    if (isAnonShared) {
      ops.push(incrWithTtl(`usage:global:${ymd}:${input.action}:anon:${input.status}`, 1));
    }

    // Analyze v2 (JD Matching) vs v3 (CV-Solo) split. Sub-counters keyed under
    // a pseudo-action `analyze-v2` / `analyze-v3` so the reader can use the same
    // key shape as the primary `analyze` counter. Variant intentionally only
    // applies to `analyze`; other actions ignore it.
    if (input.action === 'analyze' && input.variant) {
      const variantAction = `analyze-${input.variant}`;
      ops.push(incrWithTtl(`usage:global:${ymd}:${variantAction}:${input.status}`, 1));
      if (isAnonShared) {
        ops.push(incrWithTtl(`usage:global:${ymd}:${variantAction}:anon:${input.status}`, 1));
      }
    }

    // Shared-key spend dedicated bucket — drives the alert webhook.
    let sharedCallsToday = 0;
    let sharedCostToday = 0;
    if (!input.byok) {
      sharedCallsToday = await incrWithTtl(`usage:global:${ymd}:shared:calls`, 1);
      if (cost > 0) {
        sharedCostToday = await incrWithTtl(`usage:global:${ymd}:shared:cost-muusd`, cost);
      } else {
        sharedCostToday = Number((await kv.get(`usage:global:${ymd}:shared:cost-muusd`)) ?? 0);
      }
    }

    await Promise.all(ops);

    if (!input.byok) {
      void maybeFireAlerts({ ymd, sharedCallsToday, sharedCostMicroUsd: sharedCostToday });
    }
  } catch (e) {
    console.warn('[track-usage] kv_write_failed', {
      action: input.action,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

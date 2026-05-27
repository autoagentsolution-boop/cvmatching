import { kv, kvAvailable } from '@/lib/quota/kv-client';
import { microUsdCost } from '@/lib/llm/model-prices';
import { maybeFireAlerts } from './alert-webhook';

export type UsageAction = 'analyze' | 'generate-cv' | 'extract-must-haves';
export type UsageStatus = 'ok' | 'error';

export interface TrackUsageInput {
  action: UsageAction;
  status: UsageStatus;
  byok: boolean;
  userId?: string | undefined;
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

// Company alias resolution with LLM-judged dedup.
//
// Flow (per phase-01 spec + spec §7 3-level dedup ladder):
//   1. Normalize raw company name.
//   2. Direct alias lookup `co-alias:{normalized}` → hit returns existing slug.
//   3. Find candidates by 3-char prefix scan over alias namespace.
//   4. If candidates exist → LLM judges similarity 0-1 against rawName.
//      - best ≥ 0.95 → auto-merge, write alias, return existing slug.
//      - best ≥ 0.7  → enqueue admin queue, attach alias to candidate (provisional).
//      - best < 0.7  → fall through to mint-new.
//   5. Mint new: build slug, atomic alias write via NX, save Company stub.
//
// Race handling: `setAliasIfAbsent` is NX-atomic — loser of concurrent mint
// re-reads the winner's slug. Last-write-wins on `co:{slug}` body is idempotent
// for identical input (stub data is deterministic from rawName).

import { z } from 'zod';
import { callLLM, type LlmCallResult } from '@/lib/llm/providers';
import { safeParseJson } from '@/lib/llm/safe-parse-json';
import type { LlmConfigT } from '@/lib/schemas/llm-request';
import {
  normalizeCompanyName,
  companyNameToSlug,
  nameSimilarity,
} from './normalize';
import {
  getAlias,
  setAliasIfAbsent,
  setCompany,
  getCompanyBatch,
  enqueueDedup,
  findCandidatesByPrefix,
} from './kv-client';
import type {
  Company,
  DedupCandidate,
  DedupQueueEntry,
  ResolveCompanyResult,
} from './types';

const AUTO_MERGE_THRESHOLD = 0.95;
const ADMIN_QUEUE_THRESHOLD = 0.7;
/** Below this Jaccard ratio, skip LLM rank entirely — clearly unrelated names. */
const PRE_LLM_GATE = 0.3;
/** Tier 1 staleness window — 90 days. App-enforced; no native KV TTL on `co:{slug}`. */
const TIER1_TTL_DAYS = 90;

export const RankingSchema = z.object({
  rankings: z
    .array(
      z.object({
        slug: z.string().min(1).max(80),
        score: z.number().min(0).max(1),
        reason: z.string().min(1).max(280),
      }),
    )
    .max(5),
});
export type Ranking = z.infer<typeof RankingSchema>;

export interface ResolveCompanyCtx {
  llm: LlmConfigT & { apiKey: string };
  sourceUrl: string;
  signal?: AbortSignal;
}

export async function resolveCompany(
  rawName: string,
  ctx: ResolveCompanyCtx,
): Promise<ResolveCompanyResult> {
  const trimmed = rawName.trim();
  if (!trimmed) {
    throw new Error('resolveCompany: rawName empty after trim');
  }

  const norm = normalizeCompanyName(trimmed);
  if (!norm) {
    throw new Error(`resolveCompany: name "${trimmed}" normalizes to empty (all-suffix?)`);
  }

  // 1. Direct alias hit
  const aliasHit = await getAlias(norm);
  if (aliasHit) {
    return { slug: aliasHit, created: false, provisional: false };
  }

  // 2. Prefix-scan candidates + Jaccard pre-gate to bound LLM cost
  const candidateSlugs = await findCandidatesByPrefix(norm.slice(0, 3));
  if (candidateSlugs.length > 0) {
    const candidates = await getCompanyBatch(candidateSlugs);
    const preFiltered = candidates.filter(
      (c) => nameSimilarity(trimmed, c.tier1.displayName) >= PRE_LLM_GATE,
    );
    if (preFiltered.length > 0) {
      const decision = await rankAndDecide(trimmed, preFiltered, ctx);
      if (decision.kind === 'auto-merge') {
        await setAliasIfAbsent(norm, decision.candidate.slug);
        return { slug: decision.candidate.slug, created: false, provisional: false };
      }
      if (decision.kind === 'queue') {
        await enqueueDedup({
          ...buildDedupEntry(trimmed, norm, decision.candidate),
          candidateSlug: decision.candidate.slug,
        });
        const slug = await setAliasIfAbsent(norm, decision.candidate.slug);
        return { slug, created: false, provisional: true };
      }
      // mint-new — fall through
    }
  }

  // 3. Mint new
  const newSlug = companyNameToSlug(trimmed);
  if (!newSlug) {
    throw new Error(`resolveCompany: cannot derive slug from "${trimmed}"`);
  }
  const winnerSlug = await setAliasIfAbsent(norm, newSlug);
  if (winnerSlug !== newSlug) {
    // Race: someone minted just before us. Reuse their slug.
    return { slug: winnerSlug, created: false, provisional: false };
  }
  const company = buildStubCompany(trimmed, newSlug, norm, ctx.sourceUrl);
  await setCompany(company);
  return { slug: newSlug, created: true, provisional: false };
}

export type Decision =
  | { kind: 'auto-merge'; candidate: DedupCandidate }
  | { kind: 'queue'; candidate: DedupCandidate }
  | { kind: 'mint-new' };

/** Pure threshold logic — exposed for unit tests. */
export function decideFromRanking(ranking: Ranking | null): Decision {
  if (!ranking || ranking.rankings.length === 0) return { kind: 'mint-new' };
  const best = ranking.rankings[0];
  if (!best) return { kind: 'mint-new' };
  if (best.score >= AUTO_MERGE_THRESHOLD) return { kind: 'auto-merge', candidate: best };
  if (best.score >= ADMIN_QUEUE_THRESHOLD) return { kind: 'queue', candidate: best };
  return { kind: 'mint-new' };
}

async function rankAndDecide(
  rawName: string,
  candidates: Company[],
  ctx: ResolveCompanyCtx,
): Promise<Decision> {
  let call: LlmCallResult;
  const start = Date.now();
  try {
    call = await callLLM({
      config: ctx.llm,
      system: SIMILARITY_RANKER_SYSTEM,
      user: buildRankerUserPrompt(rawName, candidates),
      expectJson: true,
      maxOutputTokens: 800,
      disableThinking: true,
      ...(ctx.signal ? { signal: ctx.signal } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Company dedup LLM call failed: ${msg.slice(0, 200)}`);
  }
  // Structured log line so operator can grep total ingest-time LLM cost
  // (`event:ingest_llm_call`) from local script runs. Per-user attribution
  // intentionally skipped — ingest is an admin operation, not user traffic.
  // KV trackUsage path skipped too: ingest fires outside the request cycle
  // and inflating per-user buckets with operator activity would skew
  // admin/usage reports.
  console.log(
    JSON.stringify({
      event: 'ingest_llm_call',
      surface: 'company-dedup',
      provider: ctx.llm.provider,
      model: ctx.llm.model,
      latencyMs: Date.now() - start,
      promptTokens: call.promptTokens ?? null,
      completionTokens: call.completionTokens ?? null,
      rawName,
      candidateCount: candidates.length,
    }),
  );
  return decideFromRanking(parseRankingResponse(call.text));
}

export function parseRankingResponse(raw: string): Ranking | null {
  const parsed = safeParseJson<unknown>(raw);
  if (!parsed) return null;
  const validated = RankingSchema.safeParse(parsed);
  return validated.success ? validated.data : null;
}

const SIMILARITY_RANKER_SYSTEM = `You are a Vietnamese-market company-name disambiguation expert. Given a NEW company name and a list of EXISTING companies, decide whether each existing company is the SAME entity as the new one.

Return JSON only — no prose, no markdown fences. Shape:
{
  "rankings": [
    { "slug": "<existing-slug>", "score": <0..1>, "reason": "<≤200 chars>" }
  ]
}

Score guide:
- 0.95-1.00: Definitely the same entity (different capitalization, legal suffix variants, brand modifier identical). E.g. "FPT Software" vs "FPT Software JSC".
- 0.70-0.94: Probably the same but possible distinct sub-brand. E.g. "FPT" vs "FPT Telecom" — needs admin review.
- 0.30-0.69: Possibly related but different entity. E.g. "FPT" vs "FPT Holdings" — likely different.
- 0.00-0.29: Clearly different entities.

Rank descending by score. Include up to 5 candidates. Be CONSERVATIVE — false merges are worse than false splits.`;

function buildRankerUserPrompt(rawName: string, candidates: Company[]): string {
  const list = candidates
    .map(
      (c, i) =>
        `${i + 1}. slug="${c.slug}" displayName="${c.tier1.displayName}" canonicalName="${c.canonicalName}"${
          c.tier1.industry ? ` industry="${c.tier1.industry}"` : ''
        }${c.tier1.hq ? ` hq="${c.tier1.hq}"` : ''}`,
    )
    .join('\n');
  return `NEW company: "${rawName}"\n\nEXISTING candidates:\n${list}\n\nReturn the ranking JSON.`;
}

function buildDedupEntry(
  rawName: string,
  normalizedName: string,
  candidate: DedupCandidate,
): DedupQueueEntry {
  return {
    rawName,
    normalizedName,
    candidateSlug: candidate.slug,
    score: candidate.score,
    reason: candidate.reason,
    enqueuedAt: new Date().toISOString(),
  };
}

function buildStubCompany(
  rawName: string,
  slug: string,
  canonical: string,
  sourceUrl: string,
): Company {
  const now = new Date();
  const expires = new Date(now);
  expires.setDate(expires.getDate() + TIER1_TTL_DAYS);
  return {
    slug,
    canonicalName: canonical,
    tier1: {
      sourceUrl,
      displayName: rawName,
      pending: true,
    },
    tier1FetchedAt: now.toISOString(),
    tier1ExpiresAt: expires.toISOString(),
    createdAt: now.toISOString(),
  };
}

# Phase 1 — Fit Tier Foundation

**Day:** Wed 2026-06-03 | **Effort:** 3-5h | **Status:** Pending

## Goal

Build tier compute lib + badge atom + update normalize + prompt to return 10-15 jobs across full score range. Server-side tier computation; client renders.

## Files

**Create:**
- `cv-ex-refactor/src/lib/jobs/fit-tier.ts` — `tierFromScore()`, `QUOTA`, `enforceQuota()`, semantic labels map
- `cv-ex-refactor/src/components/ui/tier-badge.tsx` — `<TierBadge tier="S" semanticLabel="Strong Apply" />`

**Modify:**
- `cv-ex-refactor/src/lib/jobs/types.ts` — add `tier: TierLetter` to `JobMatch`
- `cv-ex-refactor/src/lib/llm/normalize-job-recommend.ts` — drop `overallScore > 80` filter, compute tier via `tierFromScore`, apply `enforceQuota` post-LLM
- `cv-ex-refactor/src/lib/llm/prompt-job-recommend.ts` — change "3-5 jobs" → "score 10-15 candidates across full range, 3 topics/job, no >80 filter"
- `cv-ex-refactor/src/lib/schemas/job-recommend-request.ts` — verify response schema accepts new shape

## Spec — fit-tier.ts

```ts
export type TierLetter = 'S' | 'A' | 'B' | 'C' | 'D' | 'E';

const SEMANTIC: Record<TierLetter, string> = {
  S: 'Strong Apply',
  A: 'Strong Apply',
  B: 'Apply After Quick Fix',
  C: 'Stretch Opportunity',
  D: 'Low Priority',
  E: 'Low Priority',
};

export function tierFromScore(score: number): TierLetter {
  if (score >= 95) return 'S';
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 65) return 'C';
  if (score >= 55) return 'D';
  return 'E';
}

export function semanticForTier(t: TierLetter): string {
  return SEMANTIC[t];
}

export const QUOTA: Record<TierLetter, number> = { S: 1, A: 3, B: 2, C: 2, D: 1, E: 1 };

export function enforceQuota<T extends { tier: TierLetter }>(matches: T[]): T[] {
  const buckets: Record<TierLetter, T[]> = { S: [], A: [], B: [], C: [], D: [], E: [] };
  for (const m of matches) buckets[m.tier].push(m);
  const result: T[] = [];
  (['S', 'A', 'B', 'C', 'D', 'E'] as const).forEach((t) => {
    result.push(...buckets[t].slice(0, QUOTA[t]));
  });
  return result;
}
```

## Spec — tier-badge.tsx

```tsx
type Props = {
  tier: TierLetter;
  semanticLabel?: string;  // defaults from semanticForTier
  size?: 'sm' | 'md';
};

// Color per tier: gold S, green A, blue B, orange C, gray D, red E
// Rounded letter chip with tooltip showing semanticLabel + main reason if provided
```

## Implementation steps

1. Write `fit-tier.ts` per spec above (~50 LOC).
2. Write `tier-badge.tsx` (~40 LOC, no Radix tooltip; use simple `title=` attribute for v1).
3. Modify `types.ts` to add `tier: TierLetter` to `JobMatch`.
4. Modify `normalize-job-recommend.ts`:
   - Remove `if (match.overallScore <= 80) continue;` line
   - After mapping each match, set `tier: tierFromScore(match.overallScore)`
   - At end of function, call `enforceQuota(results)` before return
5. Modify `prompt-job-recommend.ts`:
   - System prompt: change job count "3-5" → "10-15 jobs covering full score range 30-100"
   - Output spec: include `tier: 'S'|'A'|'B'|'C'|'D'|'E'` field (or skip and server-compute, decide here)
   - Tighten per-job: 3 study topics max, 2 sentences whyForThisJob max
6. **Decision: trust LLM tier or always server-recompute?**
   - **Server-recompute** (safer) — ignore any `tier` field from LLM, always derive from `overallScore`. KISS.
7. Update `cv-ex-refactor/src/lib/schemas/job-recommend-request.ts` response schema — add optional `tier` (or skip if always derived).
8. Typecheck + smoke test prompt with curl/insomnia against mock CV+JD.

## Acceptance

- `npx tsc --noEmit` clean
- Test recommend endpoint với CV mẫu → response includes `tier` field per match
- Distribution across tiers (Vietnamese tech CV vs vl24h pool): at minimum S+A+B exist; D/E may be empty (acceptable)
- Underfill case (only 4 jobs S+A+B): enforceQuota returns 4, không pad

## Risks

- LLM output 10+ jobs over MAX_TOKENS → siết per-job tighter; fallback retry with 8 jobs
- Prompt drift: removing >80 filter may cause LLM to over-rank borderline jobs as 80-85 cluster → adjust prompt example range

## Next

Phase 2 — wire tier badge into job-fit UI + red flag surface both pages.

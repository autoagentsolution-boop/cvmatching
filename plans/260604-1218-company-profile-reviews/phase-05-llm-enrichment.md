# Phase 5 — LLM Enrichment Endpoint (Gemini Grounded Search)

**Effort:** 2-3h
**Owner:** lead
**Status:** pending
**Blocked by:** phase 1
**Blocks:** phase 6

## Goal

Build `/api/companies/[slug]` endpoint serving merged Company (Tier 1 + Tier 2 + Tier 3) data. Tier 2 = Gemini grounded-search enrichment producing `{ summary, pros, cons, citations }`. 30d cache. **Insufficient-source guard**: if grounded search returns <2 citable sources for a `cons` claim → don't render `cons`. Cost-counter per-month for abuse alerting.

## Files to Create

- `src/app/api/companies/[slug]/route.ts` — `GET` returns Company + Ratings merged
- `src/lib/companies/enrichment.ts` — `enrichCompany(company, ctx): Promise<Company['enrichment']>`, ≤ 180 lines
- `src/lib/companies/enrichment-prompt.ts` — prompt template + structured output schema (Zod), ≤ 100 lines
- `src/lib/companies/enrichment.test.ts` — mock Gemini response fixtures, threshold behavior
- `src/lib/companies/cost-guard.ts` — `incrEnrichCalls`, `checkMonthlyBudget`, alert hook, ≤ 80 lines

## Files to Modify

- `src/lib/companies/types.ts` — extend `Company.enrichment` shape if Phase 1 left it loose: add `insufficientSources?: boolean`, `errorReason?: string`
- `src/lib/companies/kv-client.ts` — confirm `incrEnrichCalls(month)` wrapper present

## Endpoint Contract

```
GET /api/companies/{slug}
  Auth: none (public, cacheable)
  Cache: Cache-Control: private, max-age=300 (5min client cache for re-renders)
  Response 200:
    {
      company: Company,              // Tier 1 + Tier 2 merged
      ratings: ExternalRatings | null,
      enrichmentLazy?: boolean       // true if Tier 2 was fetched fresh this request
    }
  Response 404: slug not in KV
  Response 502: enrichment LLM call failed AND cache miss (per [[feedback_error_surfacing_no_silent_fallback]])
  Response 429: monthly enrichment budget exceeded (admin-configurable cap)
```

Tier 2 + Tier 3 fetched lazily on cache miss/stale. Endpoint always returns immediately if both cached.

## Enrichment Flow

```ts
export async function enrichCompany(
  company: Company,
  ctx: { llm: LlmClient; logger: Logger; cost: CostGuard }
): Promise<Company['enrichment']> {
  await ctx.cost.assertBudget();  // throws 429 if over

  const result = await ctx.llm.groundedSearch({
    query: buildEnrichmentQuery(company),
    schema: EnrichmentSchema,     // Zod, structured output
    maxSources: 8,
    minSources: 2,
  });

  await ctx.cost.increment();

  // Insufficient-source guard
  const cons = result.cons.filter(c => c.citations.length >= 2);
  const summary = result.sourceCount >= 2 ? result.summary : '';
  const insufficientSources = result.sourceCount < 2;

  return {
    summary,
    pros: result.pros,                                  // pros can have 1 source — less defamation-critical
    cons,                                                // hard-filtered to ≥2 citations each
    citations: result.allCitations,
    enrichedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
    insufficientSources,
  };
}
```

## Prompt Template (sketch)

```ts
// enrichment-prompt.ts
export const EnrichmentSchema = z.object({
  summary: z.string().max(300),
  pros: z.array(z.object({
    text: z.string().max(200),
    citations: z.array(z.object({ title: z.string(), url: z.string().url(), date: z.string().optional() })).min(1),
  })).max(4),
  cons: z.array(z.object({
    text: z.string().max(200),
    citations: z.array(z.object({ title: z.string(), url: z.string().url(), date: z.string().optional() })).min(1),  // filtered to ≥2 in code
  })).max(4),
  sourceCount: z.number(),
  allCitations: z.array(z.object({ title: z.string(), url: z.string().url(), date: z.string().optional() })),
});

export function buildEnrichmentQuery(company: Company): string {
  return `Tóm tắt thông tin công ty "${company.canonicalName}" (${company.hqLocation ?? 'Vietnam'}, ${company.industry ?? 'unknown industry'}) dựa trên các nguồn công khai. Trả về:
- summary: 2-3 câu khái quát công ty
- pros: 2-4 điểm sáng được nhắc đến trong nguồn (mỗi điểm có ≥1 citation)
- cons: 2-4 điểm cần lưu ý (mỗi điểm có ≥1 citation; nếu không có nguồn đáng tin cậy về điểm tiêu cực, trả mảng rỗng)
- citations: tổng hợp các nguồn đã dùng

Phrasing trung lập: "Theo [nguồn], …" thay vì khẳng định trực tiếp. Tránh nêu tên cá nhân ngoài CEO/founder. Nếu công ty không đủ thông tin công khai, trả summary rỗng + arrays rỗng.`;
}
```

## Cost Guard

```ts
// cost-guard.ts
const MONTHLY_LIMIT = parseInt(process.env.COMPANY_ENRICHMENT_MONTHLY_LIMIT ?? '5000', 10);
const ALERT_THRESHOLD = MONTHLY_LIMIT * 0.8;

export class CostGuard {
  constructor(private kv: KvClient, private notifier: Pushover) {}

  async assertBudget(): Promise<void> {
    const month = ymKey();
    const count = (await this.kv.get<number>(`co-enrich-calls:${month}`)) ?? 0;
    if (count >= MONTHLY_LIMIT) throw new BudgetExceededError(count, MONTHLY_LIMIT);
    if (count === ALERT_THRESHOLD) await this.notifier.send(`Company enrichment 80% of monthly cap: ${count}/${MONTHLY_LIMIT}`);
  }

  async increment(): Promise<void> {
    await this.kv.incr(`co-enrich-calls:${ymKey()}`, 60 * 24 * 3600);  // 60d TTL
  }
}
```

## Implementation Steps

1. Define `EnrichmentSchema` (Zod) + `buildEnrichmentQuery` in `enrichment-prompt.ts`.
2. Implement `enrichCompany` per flow above. Wraps existing Gemini grounded-search client; if client doesn't support structured output + grounding together, use 2-step: (a) grounded search returns raw text + sources, (b) second structured-output call extracts schema. Document choice.
3. Implement `CostGuard`. Wire `Pushover` from existing notifier helper.
4. Implement `/api/companies/[slug]/route.ts`:
   - Load `co:{slug}` (Tier 1) — 404 if missing
   - Check `co.enrichment.expiresAt`; if stale/missing → call `enrichCompany`, update KV
   - Check `co-ratings:{slug}`; if stale/missing → fire Phase 3 `fetchExternalRatings`, update KV
   - Parallel both refresh paths via `Promise.allSettled`
   - Return merged response
5. Error surfacing per [[feedback_error_surfacing_no_silent_fallback]]:
   - 404 (slug missing) → silent ok
   - LLM 401/429/5xx with no cache → 502 with `errorReason: 'enrichment-failed'`
   - Budget exceeded → 429 with `Retry-After: {seconds-to-next-month}`
6. Unit tests `enrichment.test.ts`:
   - Mock LLM with 5 citations + 3 cons each with 2 citations → all 3 cons rendered
   - Mock LLM with 1 source only → summary empty, cons empty, insufficientSources: true
   - Mock LLM with 5 citations + 2 cons each with 1 citation → cons filtered to []
   - Cost guard: simulate 5000 prior calls → assertBudget throws
7. Smoke test endpoint against 3 real companies in preview env. Verify KV write + 30d TTL.

## Acceptance Criteria

- [ ] `GET /api/companies/{slug}` returns Tier 1 + Tier 2 + Tier 3 merged
- [ ] 30d TTL respected on `enrichment.expiresAt`; stale triggers re-fetch
- [ ] Insufficient-source guard: <2 sources → `cons: []`, `insufficientSources: true`
- [ ] Pros allowed with 1 citation each (less defamation risk than cons)
- [ ] Cost counter increments per LLM call; budget cap returns 429
- [ ] All 4xx/5xx errors surfaced (no silent fallback)
- [ ] Endpoint p95 latency ≤ 8s on cache miss, ≤ 50ms on cache hit
- [ ] `pnpm tsc --noEmit` clean
- [ ] vitest enrichment/ suite green

## Risks

- **LLM fabricates citations**: cited URLs that don't exist or don't support the claim. Mitigation: post-validate every citation URL with HEAD request (cached 24h); drop claims whose citations 404; flag `validatedCitationCount` in response for UI to display.
- **Grounded search returns mostly Wikipedia + company's own website**: enrichment becomes promotional fluff. Mitigation: prompt asks for "balanced" view; if `cons.length === 0 && pros.length >= 3`, log a `lowDiversityEnrichment` flag for admin review.
- **Vietnamese SME with zero web presence**: LLM returns nothing useful, wastes 1 call. Mitigation: cost is bounded (~$0.005/call); cache empty result 7d (not 30d) to allow earlier retry when company grows.
- **Schema validation failures**: LLM returns invalid JSON. Mitigation: existing SDK retry logic; 2 retries max; on final fail, cache `{ errorReason: 'schema-violation' }` for 24h.

## Security

- **Defamation hard guard**: ≥2 citations per `cons` item enforced in code, not prompt
- **PII**: prompt explicitly forbids non-public employee names; schema doesn't prevent — runtime regex check on `summary` + claims, reject (treat as failure) if name + role pattern detected matching non-CEO patterns
- **Endpoint is public**: no auth required, but rate-limit by IP (10 req/min existing util) to prevent enumeration of all companies
- **PII in citations**: citation `title` may include names; allow (public news headlines do this)
- **Budget cap**: env-controlled `COMPANY_ENRICHMENT_MONTHLY_LIMIT`; default 5000 / month (~$25 ceiling)

## Team Impact

- Add `COMPANY_ENRICHMENT_MONTHLY_LIMIT` to env doc
- Add Pushover alert template for 80% budget breach
- Document defamation guard rationale in `docs/system-architecture.md` (legal-adjacent decision worth tracing)

## Next Phase

→ phase-06-ui-enrichment-async.md

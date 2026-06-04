# Phase 1 — Company Entity + Alias Resolver

**Effort:** 2-3h
**Owner:** lead
**Status:** pending
**Blocks:** phases 2, 3, 4, 5, 6, 7

## Goal

Stand up the `Company` domain — types, KV CRUD wrappers, name normalization, alias index, and LLM dedup gate with conservative ≥0.95 auto-merge threshold. No UI, no ingest integration, no external scraping — those are downstream phases consuming this module.

## Files to Create

- `src/lib/companies/types.ts` — `Company`, `ExternalRatings`, `DedupCandidate` interfaces (≤ 120 lines)
- `src/lib/companies/normalize.ts` — `normalizeCompanyName(raw: string): string`, `companyNameToSlug(canonical: string): string` (≤ 80 lines)
- `src/lib/companies/alias-resolver.ts` — alias lookup, LLM dedup gate, mint-new flow (≤ 180 lines)
- `src/lib/companies/kv-client.ts` — typed wrappers over `kv-client` for `co:*`, `co-alias:*`, `co-ratings:*`, `co-dedup-queue:*`, `co-enrich-calls:*` (≤ 150 lines)
- `src/lib/companies/normalize.test.ts` — 30+ VN name variant fixtures
- `src/lib/companies/alias-resolver.test.ts` — mock LLM judge fixtures covering all 3 threshold branches
- `src/lib/companies/kv-client.test.ts` — round-trip + TTL behavior

## Files to Modify

- `src/lib/jobs/types.ts` — append `companyId?: string` to `Job`. Optional — 150 live jobs read with `undefined`, no migration.

## Key Design

### Normalize

```ts
// Drop noise → lowercase → collapse → strip punctuation
export function normalizeCompanyName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(công ty|cty|co\.?,?\s*ltd|jsc|j\.s\.c|tnhh|tnhh\s*mtv|cổ phần|cp|corporation|corp\.?|inc\.?|limited|llc|gmbh|pte\.?\s*ltd|holdings?|group)\b/gi, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')   // strip punctuation, keep VN diacritics + digits
    .replace(/\s+/g, ' ')
    .trim();
}

// Canonical → URL slug (kebab, no diacritics)
export function companyNameToSlug(canonical: string): string {
  return canonical
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}
```

### Resolve flow

```ts
export async function resolveCompany(
  rawName: string,
  ctx: { llm: LlmClient; logger: Logger }
): Promise<{ slug: string; created: boolean; provisional: boolean }> {
  const norm = normalizeCompanyName(rawName);

  // 1. Alias hit
  const aliasHit = await kv.get<string>(`co-alias:${norm}`);
  if (aliasHit) return { slug: aliasHit, created: false, provisional: false };

  // 2. LLM dedup against existing companies (top-N by trigram or KV scan limited to ~200 candidates)
  const candidates = await fetchCandidatesByPrefix(norm.slice(0, 3));
  if (candidates.length > 0) {
    const ranked = await ctx.llm.rankSimilarity(rawName, candidates);
    const best = ranked[0];
    if (best.score >= 0.95) {
      await addAlias(norm, best.slug);
      return { slug: best.slug, created: false, provisional: false };
    }
    if (best.score >= 0.7) {
      await enqueueDedup({ normalizedName: norm, rawName, candidateSlug: best.slug, score: best.score });
      // Attach provisional candidateSlug — Phase 7 admin resolves
      await addAlias(norm, best.slug);
      return { slug: best.slug, created: false, provisional: true };
    }
  }

  // 3. Mint new
  const slug = companyNameToSlug(rawName);
  await kv.set(`co:${slug}`, stubCompany(rawName, slug));
  await addAlias(norm, slug);
  return { slug, created: true, provisional: false };
}
```

### KV TTLs

| Key | TTL | Set by | Read by |
|---|---|---|---|
| `co:{slug}` | none (tier1ExpiresAt enforced in app) | Phase 1 mint, Phase 2 scrape, Phase 5 enrichment | All UI + endpoints |
| `co-alias:{norm}` | none | Phase 1 resolve | Phase 1 resolve |
| `co-ratings:{slug}` | 7d | Phase 3 scrape, admin refetch | Phase 4 + 5 |
| `co-dedup-queue:{slug}-{candidate}` | 30d | Phase 1 resolve | Phase 7 admin |
| `co-enrich-calls:{YYYY-MM}` | 60d | Phase 5 increment | Phase 5 read, monitoring |

## Implementation Steps

1. Create `types.ts` per shapes in `reports/brainstorm-260604-1218-company-profile-reviews.md` §Architecture Summary. Add `Job.companyId?: string` to `lib/jobs/types.ts`.
2. Implement `normalize.ts` per snippet above. Test fixtures (`normalize.test.ts`):
   - 30+ inputs: `"FPT"`, `"FPT Software"`, `"Công ty FPT"`, `"Cty TNHH FPT Software"`, `"FPT JSC"`, `"FPT Corp."`, `"FPT, Ltd."`, `"  FPT  "`, `"Công ty Cổ phần FPT"`, `"FPT Holdings"`, `"FPT Group"` → all normalize to `"fpt"` or `"fpt software"`/`"fpt holdings"`/`"fpt group"` (preserve distinguishing brand-modifier).
   - Edge: empty, single-char, all-noise (`"Công ty TNHH"` → `""` rejected upstream), diacritics (`"Đông Á"`), digits (`"FPT 3S"`).
3. Implement `kv-client.ts` wrappers — typed `getCompany`, `setCompany`, `getAlias`, `setAlias`, `getRatings`, `setRatings`, `enqueueDedup`, `incrEnrichCalls`. Each ≤ 15 lines, wraps existing `kv-client`.
4. Implement `alias-resolver.ts`:
   - `resolveCompany(rawName, ctx)` — flow above
   - `fetchCandidatesByPrefix(prefix)` — KV SCAN with `co-alias:{prefix}*` pattern, limit 200, hydrate to `Company` shape via mget
   - `LlmClient.rankSimilarity(name, candidates) → Array<{ slug, score }>` — wrap Gemini call with structured-output schema `{ rankings: [{ slug, score: 0-1, reason }] }`
5. Test `alias-resolver.test.ts`:
   - Mock LLM returning known scores → assert auto-merge (0.97), queue (0.85), mint (0.5)
   - Race: 2 concurrent resolves of same new name → 1 mint, 1 alias hit (use KV NX semantics or accept duplicate-write idempotency)
6. Run `pnpm tsc --noEmit`, `pnpm vitest run companies/` until green.

## Acceptance Criteria

- [ ] `lib/companies/` directory created with 4 source files + 3 test files, each ≤ stated line budget
- [ ] `Job.companyId?: string` added; existing 150 jobs unaffected (read returns undefined)
- [ ] Normalize handles 30+ VN name variants consistently (test asserts)
- [ ] Resolve flow exercises all 3 branches (auto / queue / mint) — tested
- [ ] KV wrappers typed, no `any` leaks
- [ ] `pnpm tsc --noEmit` clean
- [ ] vitest companies/ suite green
- [ ] No production KV writes from tests (use mocked kv-client per existing pattern)

## Risks

- **Race on concurrent first-mint**: 2 ingest workers hit same new company simultaneously → both mint. Mitigation: KV `setnx` for `co-alias:{norm}` write; loser re-reads alias and uses winner's slug. Idempotent — accept duplicate `co:{slug}` write (last-write-wins, same data).
- **KV SCAN cost**: prefix-scan over `co-alias:*` can grow O(n) with company count. At pilot ≤1.5K companies fine; flag for Phase 8 Postgres trigram index migration if KV cost spikes.
- **LLM dedup latency** adds ~500ms-1s to ingest of new companies. Mitigation: this only fires on alias-miss; existing companies hit cache instantly. Acceptable since ingest is offline batch.

## Security

- LLM call uses existing client + token-budget guard; no new key surface
- KV keys namespaced `co:*` — no collision with existing `job:*`, `usage:*`
- Per [[feedback_secrets_never_generated_in_chat]] — no per-feature secrets

## Next Phase

→ phase-02-ingest-tier1-scrape.md
→ phase-03-external-ratings.md (parallel after this)
→ phase-05-llm-enrichment.md (parallel after this)

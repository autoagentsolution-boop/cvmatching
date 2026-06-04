# Phase 3 — External Ratings (Glassdoor + Google, Link-Out Only)

**Effort:** 2-3h
**Owner:** lead
**Status:** pending
**Blocked by:** phase 1
**Blocks:** phase 4

## Goal

Scrape **score + review count + source URL** (no review body, no review text) from Glassdoor and Google for each company. 7d cache. Admin manual refetch endpoint. UI renders as inline badges with link-out. Defamation-safe — we never display third-party review prose.

## Files to Create

- `src/lib/scrape/external-ratings/glassdoor.ts` — `fetchGlassdoorRating(canonicalName, country='VN'): Promise<{ score, count, url } | null>`
- `src/lib/scrape/external-ratings/google.ts` — `fetchGoogleRating(canonicalName, hqLocation?): Promise<{ score, count, url } | null>`
- `src/lib/scrape/external-ratings/index.ts` — dispatcher `fetchExternalRatings(company)`
- `src/app/api/admin/companies/[slug]/refetch-ratings/route.ts` — `POST` triggers refetch, admin-auth gated
- `src/lib/scrape/external-ratings/glassdoor.test.ts`, `google.test.ts` — fixture HTML / search result snapshots

## Files to Modify

- `src/lib/companies/kv-client.ts` (from Phase 1) — confirm `getRatings`, `setRatings` wrappers handle 7d TTL via existing kv `ex` option

## Source Strategy

### Glassdoor

- Search URL: `https://www.glassdoor.com/Search/results.htm?keyword={encoded-canonical-name}` — first organic result
- Score selector: `[data-test="rating"]`, count selector: `[data-test="review-count"]` (verify live; sites change)
- VN companies often have ≤5 reviews or no presence → expect frequent `null` returns
- Anti-bot: heavy. Use existing `fetch-html.ts` + `detect-antibot.ts`; on 403/Cloudflare challenge → cache `null` with 7d TTL, surface in admin diagnostics

### Google

- Use Google's knowledge panel via Search HTML scrape (search query: `"{canonical-name} {hqLocation}"`)
- Knowledge panel selectors: `.g-stars-numeric`, count "(N reviews)" — fragile, document selector version in parser file
- Or: Google Maps Place API if user already has key in env — preferred long-term but skip until Phase 8 budget; pilot scrape-only
- Returns `null` on no knowledge panel match — common for SMBs

## Data Shape

```ts
// lib/companies/types.ts (added in Phase 1)
export interface ExternalRatings {
  companyId: string;
  glassdoor?: { score: number; count: number; url: string };
  google?: { score: number; count: number; url: string };
  fetchedAt: string;
  expiresAt: string;
  errors?: { glassdoor?: string; google?: string };  // for admin visibility
}
```

Both providers always attempted in parallel. Partial success cached (e.g. Google ok, Glassdoor 403 → store google + errors.glassdoor).

## Refresh Policy

| Trigger | Behavior |
|---|---|
| `co-ratings:{slug}` missing | Lazy fetch on first `/api/companies/[slug]` call (Phase 5) |
| `co-ratings:{slug}` past `expiresAt` (7d) | Lazy fetch on next read |
| `POST /api/admin/companies/{slug}/refetch-ratings` | Force fetch, ignore cache, overwrite |
| Cache contains `errors.*` | Treat as cached failure for full 7d (no hammer); admin can force-refetch |

## API Endpoint

```
POST /api/admin/companies/{slug}/refetch-ratings
  Auth: existing admin middleware (DISABLE_SHARED_KEY-aware)
  Body: none
  Response 200: { ratings: ExternalRatings, durationMs }
  Response 401: not admin
  Response 404: company slug not in KV
  Response 502: both providers failed (returns errors detail)
```

## Implementation Steps

1. Probe Glassdoor + Google live: open browser, search 5 sample VN companies (FPT, VinGroup, MoMo, Tiki, VinFast), capture rating panel HTML. Save to `tests/fixtures/external-ratings/`.
2. Implement `glassdoor.ts`:
   - Fetch search URL via existing `fetch-html.ts`
   - On Cloudflare challenge response → return `null` + `error: 'antibot-block'`
   - Parse score/count from first result card
   - Best-effort: try 1 retry with different User-Agent before giving up
3. Implement `google.ts`: similar pattern, parse knowledge panel from search result HTML.
4. Implement dispatcher `fetchExternalRatings(company)`:
   - Parallel `Promise.allSettled([glassdoor(), google()])`
   - Build `ExternalRatings` with successes + errors
   - Set `expiresAt = now + 7d`
5. Implement admin endpoint. Reuse existing admin auth helper from `src/app/api/admin/*` patterns. Call dispatcher, overwrite `co-ratings:{slug}`, return.
6. Unit tests with fixture HTML for both providers, snapshot expected `ExternalRatings` shape.
7. Smoke test admin endpoint: deploy to preview, hit endpoint for 1 known company, verify KV write + response.

## Acceptance Criteria

- [ ] Glassdoor + Google scrape extract `{ score, count, url }` from fixture HTML
- [ ] Partial success behavior: 1 fails, other succeeds → cached with `errors.{failed}` populated
- [ ] 7d TTL enforced via KV `ex` option (read after 7d returns undefined → re-scrape)
- [ ] Admin refetch endpoint gated by existing admin auth; unauth → 401
- [ ] Admin refetch overwrites cache (force-refresh proven)
- [ ] No review body text stored anywhere — verified by grep on KV dump
- [ ] `pnpm tsc --noEmit` clean
- [ ] vitest external-ratings/ suite green

## Risks

- **Glassdoor anti-bot blocks at scale**: high likelihood. Mitigation: per-week budget on Glassdoor scrape (e.g. 100 unique companies/week) tracked via KV counter; over budget → skip Glassdoor for the week, Google-only ratings. Acceptable since UI handles partial data.
- **Google selector drift**: knowledge panel HTML changes 2-3×/year. Mitigation: parser includes 2 fallback selector patterns; logs `googleSelectorMissed` counter; alert at >20% miss rate weekly.
- **ToS concern on Glassdoor**: scraping public profile pages without account login is grey-area. Mitigation: link-out only (we drive traffic TO Glassdoor), no review body cached/displayed, respect `robots.txt` ratepath, 7d cache minimizes load. Document risk in security review notes.
- **Latency**: 2 external fetches × ~2s each = 4s. Mitigation: parallel via `Promise.allSettled`; only runs on cache miss; UI lazy-loads (Phase 4 + 6) so doesn't block first paint.

## Security

- Admin endpoint behind existing admin middleware + `DISABLE_SHARED_KEY` flag per memory [[project_cvmatching_v01_state]]
- Rate-limit admin endpoint to 10 req/min per IP (use existing rate-limit util)
- Cached URLs displayed in UI must be `rel="noopener noreferrer nofollow"` (Phase 4)
- No review body content stored — defamation surface = zero
- Errors detail in response body may include source error messages; redact internal stack traces

## Team Impact

- **Docs update**: `docs/system-architecture.md` — add Tier 3 external ratings to data flow diagram
- **Operational runbook**: when Glassdoor block-rate spikes >50%, admin disables Glassdoor scrape via env flag (add `EXTERNAL_RATINGS_GLASSDOOR_ENABLED=false` to env list)

## Next Phase

→ phase-04-ui-company-card.md

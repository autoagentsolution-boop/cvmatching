# Recon — TopCV + VNW URL scheme drift, Phase 5 scrapers

Date: 2026-06-07 11:26 ICT
Plan: `260606-1231-jobfit-db-pool-monetize` Phase 5
Scope: verify Phase 5 ingest runners against live Cloudflare-gated boards

## TL;DR

- TopCV listing URL scheme changed since plan research (2026-06-06 → 2026-06-07). Old `viec-lam-{name}-c{id}.html` is 404; new is bare `/viec-lam-{name}` or `/tim-viec-lam-{name}` (no `.html`). JSON-LD ItemList now nested inside `SearchResultsPage.mainEntity`, not top-level.
- VNW listing URL scheme also changed. Old `/viec-lam-{name}-k{id}` is 404; new patterns from live sitemap: `/{keyword}-kv` (15 jobs/page) or `/tim-viec-lam` master page (746 jv-links). No JSON-LD ItemList anywhere.
- TopCV scraper FIXED + verified end-to-end (50 URLs discovered live, all tests pass).
- VNW scraper NEEDS strategy decision before rewrite — single master page vs N keyword pages.
- Bonus: fixed dispatcher bug blocking `--dry-run` without GEMINI_API_KEY (env-pull masks Sensitive vars).

## Changes shipped

| File | Change |
|---|---|
| `scripts/ingest-jobs.ts` | Skip `assertEnv()` when cmd is topcv/vnw + `--dry-run` in args. Discovery-only path needs curl, not Gemini/KV. |
| `scripts/ingest-topcv.ts` | `normalizeTopcvSlug`: strip `.html` + `/`, accept both `viec-lam-` and `tim-viec-lam-` prefixes. Header doc rewritten with verified 2026-06-07 scheme. |
| `src/lib/scrape/jsonld-itemlist.ts` | `extractItemListUrls` now walks JSON-LD recursively + accepts nested `itemListElement[].item.url` shape (TopCV `SearchResultsPage.mainEntity`). Backward-compatible with ITviec top-level shape. |
| `tests/ingest-discovery.test.ts` | normalizeTopcvSlug expectations updated to 2026-06-07 contract (no `.html`, accept both prefixes). |

### Verification

```
pnpm run ingest topcv viec-lam-it --pages 1 --dry-run
→ Discovered 50 unique job-detail URLs (JSON-LD path, 0 regex fallback)
```

Test suite: 437 passed | 10 skipped — no regressions.

## TopCV findings (verified live)

```
GET /                                  → 200, 1.14MB
GET /viec-lam-it-phan-mem-c10026.html  → 404  (legacy scheme dead)
GET /viec-lam-it-phan-mem-c10026       → 404  (legacy scheme dead)
GET /viec-lam-it                       → 200, 1.86MB, JSON-LD nested
GET /tim-viec-lam-it-phan-mem          → 200, 1.64MB, JSON-LD nested
GET /tim-viec-lam-lap-trinh-vien       → 200, 1.69MB, JSON-LD nested
GET /tim-viec-lam-data-engineer        → 200, 1.65MB, JSON-LD nested
GET /viec-lam-it?page=2                → 200, 1.86MB (same byte length as p1 — pagination via ?page=N likely client-side; verify per slug)
```

JSON-LD shape (live):
```json
{ "@type": ["SearchResultsPage","CollectionPage"],
  "mainEntity": { "@type": "ItemList",
    "itemListElement": [
      { "position": 1, "item": { "@type": "WebPage", "url": "https://www.topcv.vn/viec-lam/{slug}/{id}.html" } },
      ...
    ]
  }
}
```

Detail URL families surfaced:
- `/viec-lam/{slug}/{numeric-id}.html` — primary (slash before ID, NOT dash)
- `/brand/{brand}/tuyen-dung/{slug}-j{id}.html` — branded campaign jobs

**Note:** Runner's `extractTopcvDetailUrls` regex `[^"'\s]+-\d+\.html` matches neither format (wrong delimiter + missed `j` prefix). Currently dead code for new scheme — JSON-LD path catches everything. Can be left or cleaned up; not blocking.

### Live TopCV slugs to seed pool (sample, verified 200 OK)

- `viec-lam-it` (broad IT) — covers most tech.* sub-verticals
- `tim-viec-lam-it-phan-mem` — software-focused
- `tim-viec-lam-lap-trinh-vien` — developer roles
- `tim-viec-lam-data-engineer` — data tech
- `tim-viec-lam-cong-nghe-thong-tin-cr257` — official IT category (cr-id form)

## VNW findings (verified live)

```
GET /                                  → 200, 213KB (almost zero text — fully client-rendered)
GET /viec-lam-cong-nghe-thong-tin-k1   → 404  (legacy scheme dead)
GET /cong-nghe-thong-tin-k1            → 404  (legacy scheme dead)
GET /viec-lam-it                       → 404
GET /tim-viec-lam                      → 200, 1.85MB, 746 `-{id}-jv` links (master search)
GET /tim-viec-lam?cat=10000            → 200, 1.55MB, 746 jv-links (query param NOT server-honored)
GET /tim-viec-lam?q=data+engineer      → 200, 1.55MB, 746 jv-links (query param NOT server-honored)
GET /data-engineer-kv                  → 200, 293KB,  15 jv-links (keyword search SSR)
GET /data-analyst-kv                   → 200, 292KB,  15 jv-links
GET /software-engineer-kv              → 200, 293KB,  15 jv-links
GET /it-jobs-kv                        → 404
GET /sitemap/sitemap.xml               → 200, 1.5KB (sitemap index)
GET /sitemap/cate_title.xml            → 200, 2.9MB, 19,280 category URLs
```

No JSON-LD ItemList anywhere on VNW listings. `__NEXT_DATA__` script present on every page (Next.js SSR).

### VNW URL families in production

From `cate_title.xml` (19,280 entries):
- `/{keyword}-kv` — bare keyword vacancy search (e.g. `data-analyst-kv`, `intern-job-kv`)
- `/{keyword}+tai-{city}-v{id}-vn` — keyword + city (e.g. `intern-reactjs+tai-ho-chi-minh-v29-vn`)

15 jv-links per `-kv` page vs 746 jv-links on the master `/tim-viec-lam`. Master is denser but appears unfiltered — no proven way to filter server-side.

### Open question (operator decision needed)

**VNW strategy** — pick one:

| Option | Pros | Cons |
|---|---|---|
| **A. Crawl `/tim-viec-lam` master only** | 1 fetch → 746 unique URLs; high yield/request | No vertical filter at source — relies entirely on post-fetch taxonomy classify; wastes embed budget on misses |
| **B. Crawl N `/{keyword}-kv` per vertical** | Built-in keyword filter; ~15 jobs/page × 10-15 keywords/vertical ≈ 150-225 fresh URLs/vertical/cycle | More requests (slower), needs per-vertical keyword whitelist in taxonomy SOURCES.vnw |
| **C. Hybrid** | Master for breadth, `-kv` for verticals starved by master | More code paths to maintain |

**Recommendation (low confidence — depends on classify accuracy):** B. Filter-before-scrape is project policy per memory `feedback_filter_before_scrape`. 150-200 URLs/vertical from VNW should saturate the pool target.

Pagination is unverified for `/{keyword}-kv` — no `?page=` test conducted because master page didn't honor it. Worth probing per slug if B is picked.

## Phase 5 follow-ups

- [ ] Decide VNW strategy (A/B/C above) — operator
- [ ] Rewrite `scripts/ingest-vnw.ts` listing URL builder per decision
- [ ] Add `SOURCES.topcv` + `SOURCES.vnw` slug whitelists to `src/lib/jobs/taxonomy.ts` (deferred from Phase 5 ship, never landed)
- [ ] Operator: live ingest cycle once VNW landed (needs `GEMINI_API_KEY` env locally — currently masked by `vercel env pull`)
- [ ] Detail-URL regex in `extractTopcvDetailUrls` is dead code for 2026 scheme — clean up OR update for `/viec-lam/{slug}/{id}.html` slash-delimited form
- [ ] Re-validate TopCV `?page=N` pagination per slug (master returned identical bytes for p2 — possibly client-side scroll)

## Constraints respected

- No mocks / no stubs — all probes were live HTTP.
- Discovery-only `--dry-run` path bypasses GEMINI/KV per `feedback_secrets_never_generated_in_chat` + `feedback_single_env_production_only` (no dev creds exist).
- `fetchViaCurl` used throughout — Node fetch blocked by Cloudflare per `feedback_cloudflare_node_fetch_blocked`.
- Edit-existing-files; no new files except this report.

## Unresolved

- VNW classify accuracy without source-side filter is unmeasured — needs benchmark before committing to Option A.
- TopCV `?page=N` behavior per slug — sample of 1 inconclusive.
- Taxonomy `SOURCES.topcv` / `SOURCES.vnw` schema not yet defined (Phase 5 plan stub never elaborated).

# Phase 6 — UI Enrichment Async (Citations + Disclaimer)

**Effort:** 1-2h
**Owner:** lead
**Status:** pending
**Blocked by:** phases 4, 5
**Blocks:** none

## Goal

Mount the Suspense slot reserved in Phase 4 with a client component that fetches `/api/companies/{slug}` enrichment async, renders summary + pros + cons with inline citation chips, and shows the mandatory disclaimer text. Skeleton during load. Empty/insufficient-source state handled gracefully.

## Files to Create

- `src/features/job-fit/company-card-enrichment.tsx` — client component, ≤ 180 lines
- `src/features/job-fit/enrichment-citation-chip.tsx` — citation chip (link out + numbered ref), ≤ 60 lines
- `src/features/job-fit/enrichment-skeleton.tsx` — loading state, ≤ 40 lines
- `src/features/job-fit/company-card-enrichment.test.tsx` — RTL render states
- `src/features/job-fit/api-client-companies.ts` — client-side fetcher with SWR pattern, ≤ 80 lines

## Files to Modify

- `src/features/job-fit/company-card.tsx` (from Phase 4) — replace placeholder `<CompanyCardEnrichment companyId={...} />` import

## Render States

| State | Trigger | UI |
|---|---|---|
| Loading | First load, no SWR cache | Skeleton (3 shimmer bars) |
| Success | Enrichment present, summary non-empty | Summary + Pros list + Cons list (if non-empty) + Citation footer + Disclaimer |
| Insufficient sources | `insufficientSources: true` | "Chưa đủ nguồn công khai để tổng hợp" + Citations footer if any + Disclaimer |
| Pros only | Pros present, cons empty (post-filter) | Summary + Pros + "Không có lưu ý đáng kể từ nguồn công khai" + Disclaimer |
| Error | API 502 / network fail | "Không tải được thông tin tổng hợp" + retry button (refetches) |
| Budget exceeded | API 429 | Hidden (silent) — Tier 1 + ratings still visible above |

## Component Sketch

```tsx
// company-card-enrichment.tsx
'use client';
import useSWR from 'swr';
import { fetchCompanyEnrichment } from './api-client-companies';
import { EnrichmentCitationChip } from './enrichment-citation-chip';
import { EnrichmentSkeleton } from './enrichment-skeleton';

const DISCLAIMER = 'Tổng hợp từ nguồn công khai, không phản ánh quan điểm của CVMatching.';

export function CompanyCardEnrichment({ companyId }: { companyId: string }) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/companies/${companyId}`,
    fetchCompanyEnrichment,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60_000 }
  );

  if (isLoading) return <EnrichmentSkeleton />;
  if (error?.status === 429) return null;  // silent on budget cap
  if (error) return <EnrichmentError onRetry={() => mutate()} />;

  const enrichment = data?.company.enrichment;
  if (!enrichment) return null;

  const { summary, pros, cons, citations, insufficientSources } = enrichment;

  return (
    <section className={styles.enrichment} aria-labelledby="company-summary-heading">
      <h4 id="company-summary-heading" className="sr-only">Tổng hợp thông tin công ty</h4>

      {insufficientSources && !summary && (
        <p className={styles.muted}>Chưa đủ nguồn công khai để tổng hợp.</p>
      )}

      {summary && <p className={styles.summary}>{summary}</p>}

      {pros.length > 0 && (
        <div className={styles.section}>
          <h5>Điểm sáng</h5>
          <ul>
            {pros.map((p, i) => (
              <li key={i}>
                {p.text}
                <CitationRefs items={p.citations} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {cons.length > 0 && (
        <div className={styles.section}>
          <h5>Lưu ý</h5>
          <ul>
            {cons.map((c, i) => (
              <li key={i}>
                {c.text}
                <CitationRefs items={c.citations} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {citations.length > 0 && (
        <footer className={styles.citationsFooter}>
          <h5>Nguồn ({citations.length})</h5>
          <ol className={styles.citationsList}>
            {citations.map((cite, i) => (
              <li key={i}>
                <EnrichmentCitationChip index={i + 1} citation={cite} />
              </li>
            ))}
          </ol>
        </footer>
      )}

      <p className={styles.disclaimer}>{DISCLAIMER}</p>
    </section>
  );
}
```

## Citation Chip

```tsx
// enrichment-citation-chip.tsx
export function EnrichmentCitationChip({ index, citation }: Props) {
  return (
    <a href={citation.url} target="_blank" rel="noopener noreferrer nofollow"
       className={styles.chip} aria-label={`Nguồn ${index}: ${citation.title}`}>
      <span className={styles.index}>[{index}]</span>
      <span className={styles.title}>{citation.title}</span>
      {citation.date && <span className={styles.date}>{formatDate(citation.date)}</span>}
    </a>
  );
}

// Inline ref next to claim
export function CitationRefs({ items }: { items: Citation[] }) {
  return (
    <span className={styles.refs}>
      {items.map((c, i) => (
        <a key={i} href={c.url} target="_blank" rel="noopener noreferrer nofollow"
           className={styles.refLink} aria-label={`Nguồn: ${c.title}`}>
          [{indexOfCitationInList(c)}]
        </a>
      ))}
    </span>
  );
}
```

## Client-Side Fetcher

```ts
// api-client-companies.ts
export async function fetchCompanyEnrichment(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error(`Company fetch failed: ${res.status}`);
    (error as any).status = res.status;
    throw error;
  }
  return res.json() as Promise<{ company: Company; ratings: ExternalRatings | null }>;
}
```

## Implementation Steps

1. Build skeleton + error fallback components first (small, no-deps).
2. Build `EnrichmentCitationChip` + `CitationRefs` — keep markup-only, no logic.
3. Build `CompanyCardEnrichment` per sketch. Use SWR with 5-min deduping (matches API `Cache-Control: max-age=300`).
4. Wire `'use client'` boundary; ensure parent server component (Phase 4 card) passes only `companyId: string` prop (serializable).
5. Replace placeholder import in `company-card.tsx`.
6. RTL tests covering 6 states per matrix.
7. Visual check in dev server. Screenshot 3 real-company examples to `Screenshot/enrichment-{slug}.png`.
8. Verify disclaimer always renders when enrichment block visible (lint: snapshot test asserts presence).

## Acceptance Criteria

- [ ] All 6 render states proven via RTL snapshot
- [ ] Disclaimer text rendered on every non-error/non-null state
- [ ] Citations clickable, open in new tab with `rel="noopener noreferrer nofollow"`
- [ ] Citation refs inline next to claims (1-indexed, matching footer order)
- [ ] Skeleton renders ≤ 100ms after mount
- [ ] SWR cache hit on re-mount within 5min (no duplicate API call — DevTools network panel verified)
- [ ] Budget-exceeded state silent (UI doesn't error visibly — Tier 1 still shows)
- [ ] No untranslated English text, no leaked AI prompt fragments per [[feedback_ui_ux_design_system]]
- [ ] `pnpm tsc --noEmit` clean

## Risks

- **Suspense + use client + SWR boundary**: Next.js 16 boundary rules can cause hydration mismatch if server-rendered Tier 1 differs from client-fetched Tier 2 timing. Mitigation: `'use client'` directive on enrichment component only; parent (Phase 4) stays server component; Suspense fallback always renders identically server-side.
- **Long enrichment text overflows card width**: 300-char summary + 4 pros × 200-char + 4 cons × 200-char = ~2KB text. Mitigation: card width fixed 320px desktop / full mobile; line-clamp not used (defeats readability) but expandable `<details>` for sections > 6 items.
- **Citation chip wrap**: long citation titles wrap awkwardly. Mitigation: max-width on chip + ellipsis on title overflow; full title in `aria-label` + tooltip.
- **Refresh stampede**: 10 users on same job within 30d-expiry-edge → cache miss for all 10 → 10 LLM calls. Mitigation: API endpoint uses `lock-then-fetch` pattern (KV setnx lock 30s); concurrent requests await first one's result. Document if not present.

## Security

- All external links `rel="noopener noreferrer nofollow"` (lint asserts)
- Citation URLs validated as `http(s)://` before render (no `javascript:` injection)
- No `dangerouslySetInnerHTML` anywhere
- Disclaimer text is fixed constant — no interpolation from API
- Pros/cons text passes through React's default escaping

## Team Impact

- Visual sign-off needed (full enrichment card screenshot)
- Add citation-style guide note to `docs/system-architecture.md` if Phase 8 UGC reviews need consistent treatment

## Next Phase

→ phase-07-admin-tooling.md

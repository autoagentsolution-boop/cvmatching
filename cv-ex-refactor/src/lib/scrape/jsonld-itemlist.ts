// Shared helper for job-board listing pages that embed Google for Jobs
// `<script type="application/ld+json">` blocks containing ItemList with
// itemListElement[].url entries (one per surfaced job card). Used by
// ITviec, TopCV, and VietnamWorks listing-page discovery.
//
// Walks the JSON-LD payload recursively because boards differ on where
// they place ItemList:
//   - ITviec: top-level `{"@type":"ItemList", itemListElement:[...]}`
//   - TopCV (2026-06): nested at SearchResultsPage.mainEntity, with each
//     itemListElement wrapping the URL inside `.item.url` instead of `.url`.
// Caller dedups via a Set; tolerates multiple ItemList blocks per page.
//
// Boards that don't embed an ItemList at all → fall back to regex over <a>
// tags (per-source URL pattern lives at the caller).

function hasType(obj: Record<string, unknown>, target: string): boolean {
  const t = obj['@type'];
  if (typeof t === 'string') return t === target;
  if (Array.isArray(t)) return t.includes(target);
  return false;
}

/**
 * Extract every itemListElement[].url from JSON-LD ItemList blocks in `html`.
 * Pure function — no I/O. Returns [] when nothing matches (never throws).
 */
export function extractItemListUrls(html: string): string[] {
  const urls: string[] = [];
  const re = /<script[^>]*type=['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/g;
  for (const m of html.matchAll(re)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1]!.trim());
    } catch {
      continue;
    }
    walk(parsed, urls);
  }
  return urls;
}

function walk(node: unknown, out: string[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, out);
    return;
  }
  if (typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;

  if (hasType(obj, 'ItemList') && Array.isArray(obj['itemListElement'])) {
    for (const el of obj['itemListElement']) {
      if (!el || typeof el !== 'object') continue;
      const er = el as Record<string, unknown>;
      // Direct shape (ITviec): { url: "..." }
      if (typeof er['url'] === 'string') {
        out.push(er['url']);
        continue;
      }
      // Nested shape (TopCV SearchResultsPage): { item: { url: "..." } }
      const item = er['item'];
      if (item && typeof item === 'object') {
        const u = (item as Record<string, unknown>)['url'];
        if (typeof u === 'string') out.push(u);
      }
    }
    return;
  }

  // Not an ItemList itself — descend into all object/array properties so
  // we find ItemLists nested under e.g. SearchResultsPage.mainEntity.
  for (const v of Object.values(obj)) walk(v, out);
}

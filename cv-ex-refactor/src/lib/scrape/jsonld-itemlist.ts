// Shared helper for job-board listing pages that embed Google for Jobs
// `<script type="application/ld+json">` blocks containing ItemList with
// itemListElement[].url entries (one per surfaced job card). Used by
// ITviec, TopCV, and VietnamWorks listing-page discovery.
//
// Boards that don't embed an ItemList → fall back to regex over <a> tags
// (per-source URL pattern lives at the caller).

interface ItemList {
  '@type'?: unknown;
  itemListElement?: Array<{ url?: unknown }>;
}

/**
 * Extract every itemListElement[].url from JSON-LD ItemList blocks in `html`.
 * Tolerates multiple ItemList blocks per page (some boards embed once in
 * <head> and once at the bottom of <body>); caller dedups via a Set.
 *
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
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      if ((item as ItemList)['@type'] !== 'ItemList') continue;
      for (const el of (item as ItemList).itemListElement ?? []) {
        if (el && typeof el.url === 'string') urls.push(el.url);
      }
    }
  }
  return urls;
}

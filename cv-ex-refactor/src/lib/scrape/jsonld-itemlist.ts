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
 * 2026-06-10 Phase 9 — entries now carry an optional `name` so callers can
 * pre-filter listings by job title BEFORE the detail-page fetch (saves
 * Cloudflare quota + LLM enrichment cost on obviously off-target roles).
 */
export interface ItemListEntry {
  url: string;
  name?: string;
}

/**
 * Extract every itemListElement[].{url,name} from JSON-LD ItemList blocks
 * in `html`. Pure function — no I/O. Returns [] when nothing matches
 * (never throws).
 */
export function extractItemListEntries(html: string): ItemListEntry[] {
  const entries: ItemListEntry[] = [];
  const re = /<script[^>]*type=['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/g;
  for (const m of html.matchAll(re)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1]!.trim());
    } catch {
      continue;
    }
    walk(parsed, entries);
  }
  return entries;
}

/**
 * Legacy URL-only signature. Preserved for callers that don't need the
 * title (TopCV / VNW listings — Phase 9 filter wired into ITviec only).
 */
export function extractItemListUrls(html: string): string[] {
  return extractItemListEntries(html).map((e) => e.url);
}

function pickName(er: Record<string, unknown>, fallback?: Record<string, unknown>): string | undefined {
  const direct = er['name'];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  if (fallback) {
    const f = fallback['name'];
    if (typeof f === 'string' && f.trim()) return f.trim();
  }
  return undefined;
}

function walk(node: unknown, out: ItemListEntry[]): void {
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
      // Direct shape (ITviec): { url: "...", name?: "..." }
      if (typeof er['url'] === 'string') {
        const entry: ItemListEntry = { url: er['url'] as string };
        const name = pickName(er);
        if (name) entry.name = name;
        out.push(entry);
        continue;
      }
      // Nested shape (TopCV SearchResultsPage): { item: { url: "...", name?: "..." } }
      const item = er['item'];
      if (item && typeof item === 'object') {
        const itemObj = item as Record<string, unknown>;
        const u = itemObj['url'];
        if (typeof u === 'string') {
          const entry: ItemListEntry = { url: u };
          const name = pickName(er, itemObj);
          if (name) entry.name = name;
          out.push(entry);
        }
      }
    }
    return;
  }

  // Not an ItemList itself — descend into all object/array properties so
  // we find ItemLists nested under e.g. SearchResultsPage.mainEntity.
  for (const v of Object.values(obj)) walk(v, out);
}

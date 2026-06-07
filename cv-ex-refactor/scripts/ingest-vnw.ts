// VietnamWorks keyword-driven ingest (2026-06-07 re-verified).
//
// Listing URL pattern:  https://www.vietnamworks.com/{keyword}-kv
//   where {keyword} is a VNW SEO keyword path (e.g. "data-engineer",
//   "ke-toan", "marketing"). Legacy "viec-lam-{x}-k{id}" scheme is dead
//   (404 across the board). New scheme is per-keyword SSR pages emitted
//   from VNW's sitemap (cate_title.xml, 19k entries).
//
// Pagination:           NOT supported by VNW SSR. ?page=2 and /trang-2
//   both return identical bytes to page 1 — pagination is client-side
//   (infinite scroll). --pages > 1 is silently capped to 1 with a warning.
//
// Detail URL pattern:   https://www.vietnamworks.com/{slug}-{id}-jv
//
// Discovery cascade (per recon plans/reports/recon-260607-1126-…):
//   1) `<script id="__NEXT_DATA__">` JSON traversal (primary path — VNW
//      is Next.js and the SSR payload carries job objects with `-{id}-jv`
//      relative URLs).
//   2) Regex over <a href="…-{id}-jv"> fallback.
//   (JSON-LD ItemList path retained but VNW emits no ItemList in 2026 —
//   call returns [] cheaply.)
//
// Yield: ~5 unique jobs per /{keyword}-kv page. 36 verified seed slugs
// (per taxonomy SOURCES.vnw) ≈ ~150 fresh URLs per ingest cycle.
//
// Cloudflare-gated → fetchViaCurl, anti-bot delays per ITviec/TopCV.

import { fetchViaCurl, assertCurlAvailable } from './fetch-via-curl.js';
import { extractItemListUrls } from '../src/lib/scrape/jsonld-itemlist.js';

const LISTING_DELAY_MS = 1500;
const VNW_BASE = 'https://www.vietnamworks.com';

interface ParsedArgs {
  categories: string[];
  pagesPerCategory: number;
  dryRun: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { categories: [], pagesPerCategory: 1, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--pages') {
      const n = parseInt(argv[++i] ?? '1', 10);
      const wanted = Number.isFinite(n) && n > 0 ? n : 1;
      // VNW pagination is client-side; silently capping at 1 would hide the
      // operator's intent. Log so the caller adjusts expectations.
      if (wanted > 1) {
        console.warn(
          `[ingest vnw] --pages ${wanted} requested but VNW pagination is client-side only (page=N returns page-1 content). Capping at 1.`,
        );
      }
      out.pagesPerCategory = 1;
    } else if (a === '--dry-run') {
      out.dryRun = true;
    } else {
      out.categories.push(a);
    }
  }
  return out;
}

/**
 * Normalize a CLI keyword slug to the canonical "{keyword}-kv" form.
 * Accepts:
 *   data-engineer-kv                  (verbatim — canonical)
 *   data-engineer                     (append -kv)
 *   /data-engineer-kv                 (leading slash dropped)
 *   viec-lam-data-engineer-k1         (legacy form — k{id} stripped, -kv appended)
 *
 * Operator should source live slugs from VNW sitemap
 * https://www.vietnamworks.com/sitemap/cate_title.xml or from
 * taxonomy.SOURCES.vnw whitelist.
 */
export function normalizeVnwSlug(input: string): string {
  let s = input.trim().replace(/^\/+/, '').replace(/\?.*$/, '');
  // Strip legacy "viec-lam-…-k{id}" if accidentally pasted
  s = s.replace(/^viec-lam-/, '').replace(/-k\d+$/, '');
  if (!s.endsWith('-kv')) s = `${s}-kv`;
  return s;
}

function buildListingUrl(slug: string, _page: number): string {
  // VNW pagination is client-side only — ?page=N returns page-1 content.
  // Listing URL is page-agnostic; caller caps pages at 1.
  return `${VNW_BASE}/${normalizeVnwSlug(slug)}`;
}

// Detail URL regex fallback. VNW URLs end with `-{numeric-id}-jv` and may
// carry `?utm_*` tracking suffixes; we strip the query string and dedup.
// Match anywhere in body (not just href= attrs) — VNW SSR embeds the URLs
// in free-floating JSON within script tags and React-hydration markers,
// not as canonical anchor hrefs.
const VNW_DETAIL_RE = /(https?:\/\/(?:www\.)?vietnamworks\.com)?(\/[^"'\s<>?]+-\d+-jv)/g;

export function extractVnwDetailUrls(html: string): string[] {
  const urls = new Set<string>();
  for (const m of html.matchAll(VNW_DETAIL_RE)) {
    const origin = m[1] || VNW_BASE;
    urls.add(`${origin.replace(/\/$/, '')}${m[2]}`);
  }
  return [...urls];
}

/**
 * Pull job-detail URLs from Next.js's __NEXT_DATA__ SSR payload. VNW's job
 * objects carry `alias` or `url` fields with the relative path; we hunt
 * generically for any string matching `-{id}-jv`.
 *
 * Safe to call when __NEXT_DATA__ is missing — returns [].
 */
export function extractVnwNextDataUrls(html: string): string[] {
  const m = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/,
  );
  if (!m) return [];
  let json: unknown;
  try {
    json = JSON.parse(m[1]!.trim());
  } catch {
    return [];
  }
  const urls = new Set<string>();
  // Anchor-less pattern: VNW SSR embeds URLs with `?utm_*` tracking
  // suffixes after `-jv`, so a `$`-anchored match never fires. We extract
  // the path portion up to (but excluding) any `?` query string.
  const rel = /(?:https?:\/\/(?:www\.)?vietnamworks\.com)?(\/[^"'\s?]+-\d+-jv)/;
  const visit = (node: unknown): void => {
    if (!node) return;
    if (typeof node === 'string') {
      const mm = node.match(rel);
      if (mm) urls.add(`${VNW_BASE}${mm[1]}`);
      return;
    }
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (typeof node === 'object') {
      for (const v of Object.values(node as Record<string, unknown>)) visit(v);
    }
  };
  visit(json);
  return [...urls];
}

async function fetchListing(slug: string, page: number): Promise<string | null> {
  const url = buildListingUrl(slug, page);
  try {
    const r = await fetchViaCurl(url);
    if (r.status < 200 || r.status >= 300) {
      console.warn(`[ingest vnw] listing ${slug} p${page}: HTTP ${r.status}`);
      return null;
    }
    return r.body;
  } catch (err) {
    console.warn(
      `[ingest vnw] listing ${slug} p${page} fetch failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return null;
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function discoverUrls(
  categories: string[],
  pagesPerCategory: number,
): Promise<string[]> {
  const seen = new Set<string>();
  for (const cat of categories) {
    let catAdded = 0;
    for (let p = 1; p <= pagesPerCategory; p++) {
      if (p > 1) await sleep(LISTING_DELAY_MS);
      const html = await fetchListing(cat, p);
      if (!html) break;

      // Discovery cascade: __NEXT_DATA__ first (VNW emits no JSON-LD
      // ItemList in 2026; SSR payload is the primary source). Regex over
      // anchor hrefs catches anything the SSR walker misses.
      let path = '__NEXT_DATA__';
      let urls = extractVnwNextDataUrls(html);
      if (urls.length === 0) {
        urls = extractVnwDetailUrls(html);
        path = 'regex';
      }
      if (urls.length === 0) {
        urls = extractItemListUrls(html);
        path = 'json-ld';
      }

      let fresh = 0;
      for (const u of urls) {
        if (!seen.has(u)) {
          seen.add(u);
          fresh++;
          catAdded++;
        }
      }
      console.log(
        `[ingest vnw] discover ${cat} p${p} (${path}): parsed=${urls.length} fresh=${fresh} (cat-total=${catAdded})`,
      );
      // VNW /{kw}-kv pages yield ~5 unique jobs each — lower tail threshold
      // vs ITviec/TopCV.
      if (urls.length < 2) break;
    }
  }
  return [...seen];
}

export async function run(args: string[]): Promise<void> {
  const { categories, pagesPerCategory, dryRun } = parseArgs(args);
  if (categories.length === 0) {
    console.error(
      '[ingest vnw] Usage: pnpm run ingest vnw <keyword-slug> [<slug>...] [--dry-run]\n' +
        '  Example: pnpm run ingest vnw data-engineer-kv software-engineer-kv ke-toan-kv\n' +
        '  Slug forms accepted: "{kw}-kv" (canonical) or bare "{kw}" (suffix appended).\n' +
        '  --pages N is ignored (capped at 1 — VNW pagination is client-side only).\n' +
        '  --dry-run: discover URLs only, skip detail fetch + ingest (no Gemini/KV needed).\n' +
        '  Discover live slugs from taxonomy.SOURCES.vnw or VNW sitemap\n' +
        '  https://www.vietnamworks.com/sitemap/cate_title.xml',
    );
    process.exit(1);
  }

  await assertCurlAvailable();

  console.log(
    `[ingest vnw] Discovering: ${categories.join(', ')} × ${pagesPerCategory} page(s)${
      dryRun ? ' (--dry-run)' : ''
    }`,
  );
  const urls = await discoverUrls(categories, pagesPerCategory);
  console.log(`\n[ingest vnw] Discovered ${urls.length} unique job-detail URLs\n`);

  if (urls.length === 0) {
    console.error(
      '[ingest vnw] No URLs discovered. Confirm slugs at vietnamworks.com, or run curl directly against the listing URL to check Cloudflare.',
    );
    process.exit(1);
  }

  if (dryRun) {
    for (const u of urls) console.log(u);
    console.log(`\n[ingest vnw] --dry-run: printed ${urls.length} URLs, skipping ingest.`);
    return;
  }

  // 2026-06-07: VNW detail pages are pure CSR (no JSON-LD JobPosting, no
  // __NEXT_DATA__, no inline state). og:description is 193-char marketing
  // boilerplate — too noisy for embeddings. postedAt cannot be extracted.
  // Until we add a headless-browser path or reverse-engineer the
  // ms.vietnamworks.com API, discovery is the most VNW can offer.
  // Discovery + taxonomy SOURCES.vnw remain in place for future re-enable.
  console.error(
    '\n[ingest vnw] DETAIL-PAGE PARSER NOT VIABLE.\n' +
      '  VNW detail pages are fully client-rendered: no JSON-LD JobPosting,\n' +
      '  no __NEXT_DATA__ payload, only og:title + 193-char meta description\n' +
      '  (marketing boilerplate). Cannot extract postedAt (freshness ≤3d\n' +
      '  constraint) or rich description for quality embeddings.\n' +
      '\n' +
      '  This runner exits BEFORE detail-fetch + ingest. Discovery (--dry-run)\n' +
      '  still works and the taxonomy SOURCES.vnw whitelist is preserved.\n' +
      '\n' +
      '  Re-enable path: add headless-browser detail fetch (Playwright) OR\n' +
      '  reverse ms.vietnamworks.com auth flow OR scrape the still-fresh\n' +
      '  vietnamworks.com app endpoints. None of these are scoped for the\n' +
      '  2K pilot pool — use TopCV + ITviec + vl24h instead.\n' +
      '\n' +
      '  Tracked: plans/reports/recon-260607-1126-topcv-vnw-url-scheme-drift.md\n',
  );
  process.exit(2);
}

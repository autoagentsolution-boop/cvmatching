// TopCV category-driven ingest. Mirrors `ingest-itviec.ts` shape.
//
// Listing URL pattern (2026-06-07 re-verified):
//   https://www.topcv.vn/{category-slug}
//   where {category-slug} is one of:
//     viec-lam-it                          (broad nav category)
//     tim-viec-lam-it-phan-mem             (search-style category)
//     tim-viec-lam-lao-dong-pho-thong-cr1042 (search-style w/ cr-id)
//   NO ".html" suffix on the new scheme. NO "-c{id}" suffix.
//   The legacy "viec-lam-{name}-c{id}.html" pattern is dead (404).
// Pagination:           ?page=N (verify per slug — some categories use
//                       client-side infinite scroll; page=2 may return
//                       page=1 content)
// Detail URL pattern:   https://www.topcv.vn/viec-lam/{slug}-{id}.html
//                       (detail pages still use .html — only listings changed)
//
// Discovery order:
//   1) JSON-LD ItemList in listing-page <head> (preferred — Google for Jobs)
//   2) Regex over <a href="…/viec-lam/…-{id}.html"> fallback
//
// Cloudflare-gated — uses `fetchViaCurl` like ITviec/vl24h. Per-listing
// 1500ms delay + 1000ms between detail fetches (anti-bot etiquette per
// research/topcv-vnw-scrape-recon.md).

import { ingestEntries } from './ingest-file.js';
import { urlToJobInput } from './ingest-urls.js';
import { fetchViaCurl, assertCurlAvailable } from './fetch-via-curl.js';
import { extractItemListUrls } from '../src/lib/scrape/jsonld-itemlist.js';
import type { JobInput } from '../src/lib/jobs/types.js';

const LISTING_DELAY_MS = 1500;
const DETAIL_DELAY_MS = 1000;
const TOPCV_BASE = 'https://www.topcv.vn';

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
      out.pagesPerCategory = Number.isFinite(n) && n > 0 ? n : 1;
    } else if (a === '--dry-run') {
      out.dryRun = true;
    } else {
      out.categories.push(a);
    }
  }
  return out;
}

/**
 * Normalize a CLI-supplied category slug into the actual URL path segment.
 * TopCV's live (2026-06-07) listing scheme has no .html suffix and no
 * forced "viec-lam-" prefix — both "viec-lam-{x}" and "tim-viec-lam-{x}"
 * are valid first segments. Pass-through if either prefix already present;
 * otherwise prepend "viec-lam-" as the safest default. Strip any leading
 * "/" or trailing ".html" the operator might have copy-pasted.
 *
 * Accepts:
 *   viec-lam-it                         (verbatim)
 *   tim-viec-lam-it-phan-mem            (verbatim)
 *   /viec-lam-it                        (with slash)
 *   viec-lam-it.html                    (legacy form — .html stripped)
 *   it                                  (bare keyword — viec-lam- prepended)
 */
export function normalizeTopcvSlug(input: string): string {
  let s = input.trim().replace(/^\/+/, '').replace(/\.html$/, '');
  if (!s.startsWith('viec-lam-') && !s.startsWith('tim-viec-lam-')) {
    s = `viec-lam-${s}`;
  }
  return s;
}

function buildListingUrl(slug: string, page: number): string {
  const path = normalizeTopcvSlug(slug);
  return `${TOPCV_BASE}/${path}${page > 1 ? `?page=${page}` : ''}`;
}

// Regex fallback when JSON-LD ItemList absent. Captures absolute or relative
// detail URLs and rewrites relatives to the topcv.vn origin.
const TOPCV_DETAIL_RE = /href=["'](https?:\/\/(?:www\.)?topcv\.vn)?(\/viec-lam\/[^"'\s]+-\d+\.html)["']/g;

export function extractTopcvDetailUrls(html: string): string[] {
  const urls = new Set<string>();
  for (const m of html.matchAll(TOPCV_DETAIL_RE)) {
    const origin = m[1] || TOPCV_BASE;
    urls.add(`${origin.replace(/\/$/, '')}${m[2]}`);
  }
  return [...urls];
}

async function fetchListing(slug: string, page: number): Promise<string | null> {
  const url = buildListingUrl(slug, page);
  try {
    const r = await fetchViaCurl(url);
    if (r.status < 200 || r.status >= 300) {
      console.warn(`[ingest topcv] listing ${slug} p${page}: HTTP ${r.status}`);
      return null;
    }
    return r.body;
  } catch (err) {
    console.warn(
      `[ingest topcv] listing ${slug} p${page} fetch failed: ${
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

      // JSON-LD ItemList → regex fallback. Surface which path each page took
      // so the operator can spot scraper drift quickly.
      let urls = extractItemListUrls(html);
      let path = 'json-ld';
      if (urls.length === 0) {
        urls = extractTopcvDetailUrls(html);
        path = 'regex';
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
        `[ingest topcv] discover ${cat} p${p} (${path}): parsed=${urls.length} fresh=${fresh} (cat-total=${catAdded})`,
      );
      // Tail-detection: TopCV listings render ~20-25 cards. <5 indicates we
      // ran past the last populated page.
      if (urls.length < 5) break;
    }
  }
  return [...seen];
}

export async function run(args: string[]): Promise<void> {
  const { categories, pagesPerCategory, dryRun } = parseArgs(args);
  if (categories.length === 0) {
    console.error(
      '[ingest topcv] Usage: pnpm run ingest topcv <category-slug> [<slug>...] [--pages N] [--dry-run]\n' +
        '  Example: pnpm run ingest topcv viec-lam-it tim-viec-lam-data-engineer --pages 3\n' +
        '  Slug forms accepted: "viec-lam-{x}" or "tim-viec-lam-{x}"; .html suffix stripped if present.\n' +
        '  --dry-run: discover URLs only, skip detail fetch + ingest (no Gemini/KV needed).\n' +
        '  Discover live slugs from https://www.topcv.vn navigation menu.',
    );
    process.exit(1);
  }

  await assertCurlAvailable();

  console.log(
    `[ingest topcv] Discovering: ${categories.join(', ')} × ${pagesPerCategory} page(s)${
      dryRun ? ' (--dry-run)' : ''
    }`,
  );
  const urls = await discoverUrls(categories, pagesPerCategory);
  console.log(`\n[ingest topcv] Discovered ${urls.length} unique job-detail URLs\n`);

  if (urls.length === 0) {
    console.error(
      '[ingest topcv] No URLs discovered. Verify slugs on topcv.vn, or run curl manually against the listing URL to confirm Cloudflare is passing.',
    );
    process.exit(1);
  }

  if (dryRun) {
    for (const u of urls) console.log(u);
    console.log(`\n[ingest topcv] --dry-run: printed ${urls.length} URLs, skipping ingest.`);
    return;
  }

  const entries: JobInput[] = [];
  for (let i = 0; i < urls.length; i++) {
    if (i > 0) await sleep(DETAIL_DELAY_MS);
    const url = urls[i]!;
    console.log(`[ingest topcv] detail [${i + 1}/${urls.length}] ${url}`);
    const input = await urlToJobInput(url);
    if (input) {
      console.log(
        `[ingest topcv] detail [${i + 1}/${urls.length}] ✓ ${input.title} @ ${input.company}`,
      );
      entries.push(input);
    }
  }

  if (entries.length === 0) {
    console.error('\n[ingest topcv] No valid JobInput extracted. Nothing to ingest.');
    process.exit(1);
  }

  console.log(
    `\n[ingest topcv] ${entries.length}/${urls.length} URLs parsed. Handing off to ingest pipeline...\n`,
  );
  await ingestEntries(entries, 'ingest topcv');
}

// ITviec category-driven ingest: takes category slugs, discovers job-detail
// URLs from the listing pages' JSON-LD ItemList (server-rendered), fetches
// each detail page, builds JobInput[], hands off to the shared ingestEntries
// pipeline (dedup, classify, embed, save, resolveCompany, Tier 1 fire).
//
// Why ItemList instead of sitemap: ITviec sitemap is Cloudflare-gated (403
// even with browser UA); listing pages return 200 OK and embed a complete
// 20-URL ItemList per page. No JS render needed.
//
// Why operator-driven slugs (not taxonomy.ts): KISS. The slug IS the filter
// per [[feedback_filter_before_scrape]] — operator picks slugs they want
// pool coverage on. Taxonomy.ts wiring is a follow-up once we know which
// ITviec slugs hit best.

import { ingestEntries } from './ingest-file.js';
import { urlToJobInput } from './ingest-urls.js';
import { fetchViaCurl, assertCurlAvailable } from './fetch-via-curl.js';
import type { JobInput } from '../src/lib/jobs/types.js';

const LISTING_DELAY_MS = 1500;
const DETAIL_DELAY_MS = 1000;

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

async function fetchListing(category: string, page: number): Promise<string | null> {
  const url = `https://itviec.com/it-jobs/${category}${page > 1 ? `?page=${page}` : ''}`;
  try {
    const r = await fetchViaCurl(url);
    if (r.status < 200 || r.status >= 300) {
      console.warn(`[ingest itviec] listing ${category} p${page}: HTTP ${r.status}`);
      return null;
    }
    return r.body;
  } catch (err) {
    console.warn(
      `[ingest itviec] listing ${category} p${page} fetch failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return null;
  }
}

interface ItemList {
  '@type'?: unknown;
  itemListElement?: Array<{ url?: unknown }>;
}

/**
 * Pull job detail URLs out of every JSON-LD ItemList block on a listing page.
 * ITviec embeds the list twice (once at top, once at bottom of <head>); we
 * dedup at the caller via the seen-set.
 */
function extractItemListUrls(html: string): string[] {
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
      const urls = extractItemListUrls(html);
      let fresh = 0;
      for (const u of urls) {
        if (!seen.has(u)) {
          seen.add(u);
          fresh++;
          catAdded++;
        }
      }
      console.log(
        `[ingest itviec] discover ${cat} p${p}: parsed=${urls.length} fresh=${fresh} (cat-total=${catAdded})`,
      );
      // ITviec listing pages render ~20 cards; <5 means we hit the tail.
      if (urls.length < 5) break;
    }
  }
  return [...seen];
}

export async function run(args: string[]): Promise<void> {
  const { categories, pagesPerCategory, dryRun } = parseArgs(args);
  if (categories.length === 0) {
    console.error(
      '[ingest itviec] Usage: pnpm run ingest itviec <category-slug> [<slug>...] [--pages N] [--dry-run]\n' +
        '  Example: pnpm run ingest itviec data-engineer senior-data-engineer --pages 2\n' +
        '  --dry-run: discover URLs only, skip detail fetch + ingest\n' +
        '  Discover slugs from https://itviec.com/it-jobs nav menu.',
    );
    process.exit(1);
  }

  await assertCurlAvailable();

  console.log(
    `[ingest itviec] Discovering: ${categories.join(', ')} × ${pagesPerCategory} page(s)${
      dryRun ? ' (--dry-run)' : ''
    }`,
  );
  const urls = await discoverUrls(categories, pagesPerCategory);
  console.log(`\n[ingest itviec] Discovered ${urls.length} unique job-detail URLs\n`);

  if (urls.length === 0) {
    console.error('[ingest itviec] No URLs discovered. Check slugs are valid on itviec.com.');
    process.exit(1);
  }

  if (dryRun) {
    for (const u of urls) console.log(u);
    console.log(`\n[ingest itviec] --dry-run: printed ${urls.length} URLs, skipping ingest.`);
    return;
  }

  const entries: JobInput[] = [];
  for (let i = 0; i < urls.length; i++) {
    if (i > 0) await sleep(DETAIL_DELAY_MS);
    const url = urls[i]!;
    console.log(`[ingest itviec] detail [${i + 1}/${urls.length}] ${url}`);
    const input = await urlToJobInput(url);
    if (input) {
      console.log(
        `[ingest itviec] detail [${i + 1}/${urls.length}] ✓ ${input.title} @ ${input.company}`,
      );
      entries.push(input);
    }
  }

  if (entries.length === 0) {
    console.error('\n[ingest itviec] No valid JobInput extracted. Nothing to ingest.');
    process.exit(1);
  }

  console.log(
    `\n[ingest itviec] ${entries.length}/${urls.length} URLs parsed. Handing off to ingest pipeline...\n`,
  );
  await ingestEntries(entries, 'ingest itviec');
}

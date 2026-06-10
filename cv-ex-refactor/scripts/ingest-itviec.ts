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
import { extractItemListEntries, type ItemListEntry } from '../src/lib/scrape/jsonld-itemlist.js';
import type { JobInput } from '../src/lib/jobs/types.js';

// See ingest-topcv.ts comment on the same constants — same CF tolerance.
const LISTING_DELAY_MS = 3000;
const DETAIL_DELAY_MS = 2000;

interface ParsedArgs {
  categories: string[];
  pagesPerCategory: number;
  dryRun: boolean;
  /** Comma-separated keywords; case-insensitive. URL slug OR job title must match ≥1. Phase 9. */
  titleInclude: string[];
  /** Comma-separated keywords; case-insensitive. URL slug OR job title with any match is skipped. Phase 9. */
  titleExclude: string[];
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    categories: [],
    pagesPerCategory: 1,
    dryRun: false,
    titleInclude: [],
    titleExclude: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--pages') {
      const n = parseInt(argv[++i] ?? '1', 10);
      out.pagesPerCategory = Number.isFinite(n) && n > 0 ? n : 1;
    } else if (a === '--dry-run') {
      out.dryRun = true;
    } else if (a === '--title-include') {
      out.titleInclude = (argv[++i] ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    } else if (a === '--title-exclude') {
      out.titleExclude = (argv[++i] ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    } else {
      out.categories.push(a);
    }
  }
  return out;
}

/**
 * Phase 9: pre-filter URLs at listing-page parse time using URL slug +
 * (when available) job title from JSON-LD. Saves a detail fetch per
 * skipped entry — direct Cloudflare quota and LLM enrichment savings on
 * obviously off-target roles.
 *
 * Match rule:
 *   - `--title-include kw1,kw2`: keep entry when its slug OR name
 *     contains ANY of kw1/kw2 (case-insensitive substring). Empty list
 *     means "no positive filter" (keep all).
 *   - `--title-exclude kw1,kw2`: drop entry when its slug OR name
 *     contains ANY of the keywords. Empty list means no negative filter.
 *
 * Slug-only fallback when name is absent (JSON-LD didn't carry one):
 * the URL path is the only signal; include keywords still match against
 * the slug, exclude still applies.
 */
function applyTitleFilter(
  entries: ItemListEntry[],
  include: string[],
  exclude: string[],
): { kept: ItemListEntry[]; droppedByInclude: number; droppedByExclude: number } {
  if (include.length === 0 && exclude.length === 0) {
    return { kept: entries, droppedByInclude: 0, droppedByExclude: 0 };
  }
  let droppedByInclude = 0;
  let droppedByExclude = 0;
  const kept: ItemListEntry[] = [];
  for (const e of entries) {
    const haystack = `${e.url} ${e.name ?? ''}`.toLowerCase();
    if (include.length > 0 && !include.some((kw) => haystack.includes(kw))) {
      droppedByInclude++;
      continue;
    }
    if (exclude.length > 0 && exclude.some((kw) => haystack.includes(kw))) {
      droppedByExclude++;
      continue;
    }
    kept.push(e);
  }
  return { kept, droppedByInclude, droppedByExclude };
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

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function discoverUrls(
  categories: string[],
  pagesPerCategory: number,
  titleInclude: string[],
  titleExclude: string[],
): Promise<string[]> {
  const seen = new Set<string>();
  let totalFiltered = 0;
  for (const cat of categories) {
    let catAdded = 0;
    for (let p = 1; p <= pagesPerCategory; p++) {
      // Sleep before EVERY listing (not just p>1) — inter-category burst is
      // what flagged CF when delay was 1.5s.
      await sleep(LISTING_DELAY_MS);
      const html = await fetchListing(cat, p);
      if (!html) break;
      const allEntries = extractItemListEntries(html);
      const { kept, droppedByInclude, droppedByExclude } = applyTitleFilter(
        allEntries,
        titleInclude,
        titleExclude,
      );
      const filtered = droppedByInclude + droppedByExclude;
      totalFiltered += filtered;

      let fresh = 0;
      for (const e of kept) {
        if (!seen.has(e.url)) {
          seen.add(e.url);
          fresh++;
          catAdded++;
        }
      }
      console.log(
        `[ingest itviec] discover ${cat} p${p}: parsed=${allEntries.length} filtered=${filtered} kept=${kept.length} fresh=${fresh} (cat-total=${catAdded})`,
      );
      // ITviec listing pages render ~20 cards; <5 means we hit the tail
      // (compare against pre-filter count so an aggressive filter doesn't
      // truncate pagination early).
      if (allEntries.length < 5) break;
    }
  }
  if (totalFiltered > 0) {
    console.log(
      `[ingest itviec] discover: pre-filter dropped ${totalFiltered} URL(s) — ${seen.size} retained for detail fetch`,
    );
  }
  return [...seen];
}

export async function run(args: string[]): Promise<void> {
  const { categories, pagesPerCategory, dryRun, titleInclude, titleExclude } = parseArgs(args);
  if (categories.length === 0) {
    console.error(
      '[ingest itviec] Usage: pnpm run ingest itviec <category-slug> [<slug>...] [--pages N] [--dry-run] [--title-include kw1,kw2] [--title-exclude kw1,kw2]\n' +
        '  Example: pnpm run ingest itviec data-engineer senior-data-engineer --pages 2\n' +
        '  Filter ex: pnpm run ingest itviec it-jobs --title-include "senior,lead" --title-exclude "intern,fresher"\n' +
        '  --dry-run: discover URLs only, skip detail fetch + ingest\n' +
        '  Discover slugs from https://itviec.com/it-jobs nav menu.',
    );
    process.exit(1);
  }

  await assertCurlAvailable();

  const filterDesc =
    titleInclude.length > 0 || titleExclude.length > 0
      ? ` | include=[${titleInclude.join(',')}] exclude=[${titleExclude.join(',')}]`
      : '';
  console.log(
    `[ingest itviec] Discovering: ${categories.join(', ')} × ${pagesPerCategory} page(s)${
      dryRun ? ' (--dry-run)' : ''
    }${filterDesc}`,
  );
  const urls = await discoverUrls(categories, pagesPerCategory, titleInclude, titleExclude);
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
    // Sleep before every detail (including i=0).
    await sleep(DETAIL_DELAY_MS);
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

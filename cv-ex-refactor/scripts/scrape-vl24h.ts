// Scrape vieclam24h.vn → JobInput[] JSON for `pnpm run ingest file`.
//
// Pipeline (post-Phase-2 taxonomy rewrite):
//   1. sitemap-index → child sitemaps → all job-detail URLs
//   2. PRE-FILTER (cheap, no HTTP):
//        a. URL category slug → taxonomy.slugToVerticalAndSub(); reject unknown.
//        b. URL title-slug → taxonomy.classifyTitle() w/ candidate sub-domains;
//           reject negative-match or no-positive-match.
//   3. DETAIL FETCH only for surviving URLs; parse ld+json.
//   4. RE-VERIFY title against ld.title (richer than URL slug); reject if
//      now classified negative (rare but covers truncated URL slugs).
//   5. validThrough + max-age filter (unchanged).
//
// Goal: zero detail HTML fetched for jobs the taxonomy already rejects.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Vertical } from '../src/lib/jobs/types';
import {
  parseSitemapIndex,
  parseSitemap,
  parseJobPostingLd,
  ldToJobInput,
  extractCategorySlug,
  extractTitleSlugFromUrl,
  foldAndDeslug,
  isSitemapIndex,
  isJobDetailUrl,
  type VlJobInput,
} from '../src/lib/scrape/vl24h-parser';
import { classifyTitle, slugToVerticalAndSub } from '../src/lib/jobs/taxonomy';

const SITEMAP_INDEX = 'https://vieclam24h.vn/file/sitemap/sitemap-index.xml';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DETAIL_DELAY_MS = 1500;
const SITEMAP_DELAY_MS = 800;
const FETCH_TIMEOUT_MS = 12000;

interface Args {
  limitPerVertical: number;
  maxAttemptsPerVertical: number;
  dryRun: boolean;
  out: string | null;
  maxAgeDays: number | null;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    limitPerVertical: 25,
    maxAttemptsPerVertical: 60,
    dryRun: false,
    out: null,
    maxAgeDays: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--dry-run') a.dryRun = true;
    else if (arg === '--limit') a.limitPerVertical = parseInt(argv[++i]!, 10);
    else if (arg === '--max-attempts') a.maxAttemptsPerVertical = parseInt(argv[++i]!, 10);
    else if (arg === '--out') a.out = argv[++i]!;
    else if (arg === '--max-age-days') a.maxAgeDays = parseInt(argv[++i]!, 10);
  }
  return a;
}

async function fetchText(url: string): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const VERTICALS: Vertical[] = ['tech', 'marketing', 'finance', 'sales', 'ops', 'other'];

interface FilteredUrl {
  url: string;
  vertical: Vertical;
  /** Sub-vertical id from URL-slug pre-classification; may be refined at detail. */
  subVertical: string;
}

interface Bucket {
  vertical: Vertical;
  urls: FilteredUrl[];
  collected: VlJobInput[];
  attempts: number;
  failures: number;
  skippedStale: number;
  skippedExpired: number;
  skippedNoLd: number;
  rejectedAtDetail: number;
}

interface PreFilterStats {
  totalCandidates: number;
  rejectedNoSlugMatch: number;
  rejectedByTitleNeg: number;
  rejectedByTitleNoMatch: number;
  perVerticalSurviving: Record<Vertical, number>;
  perVerticalRejectedNeg: Record<Vertical, number>;
  perVerticalRejectedNoMatch: Record<Vertical, number>;
}

function newPerVertical<T>(init: T): Record<Vertical, T> {
  return VERTICALS.reduce(
    (acc, v) => {
      acc[v] = init;
      return acc;
    },
    {} as Record<Vertical, T>,
  );
}

function preFilter(urls: string[]): { surviving: FilteredUrl[]; stats: PreFilterStats } {
  const surviving: FilteredUrl[] = [];
  const stats: PreFilterStats = {
    totalCandidates: urls.length,
    rejectedNoSlugMatch: 0,
    rejectedByTitleNeg: 0,
    rejectedByTitleNoMatch: 0,
    perVerticalSurviving: newPerVertical(0),
    perVerticalRejectedNeg: newPerVertical(0),
    perVerticalRejectedNoMatch: newPerVertical(0),
  };

  for (const url of urls) {
    const slug = extractCategorySlug(url);
    if (!slug) {
      stats.rejectedNoSlugMatch++;
      continue;
    }
    const slugMatch = slugToVerticalAndSub('vl24h', slug);
    if (!slugMatch) {
      stats.rejectedNoSlugMatch++;
      continue;
    }

    const titleSlug = extractTitleSlugFromUrl(url);
    if (!titleSlug) {
      stats.rejectedNoSlugMatch++;
      continue;
    }
    const folded = foldAndDeslug(titleSlug);

    const verdict = classifyTitle(slugMatch.vertical, folded, slugMatch.candidateSubDomains);
    if (!verdict.accept) {
      if (verdict.reason === 'negative-match') {
        stats.rejectedByTitleNeg++;
        stats.perVerticalRejectedNeg[slugMatch.vertical]++;
      } else {
        stats.rejectedByTitleNoMatch++;
        stats.perVerticalRejectedNoMatch[slugMatch.vertical]++;
      }
      continue;
    }

    surviving.push({ url, vertical: slugMatch.vertical, subVertical: verdict.subVertical });
    stats.perVerticalSurviving[slugMatch.vertical]++;
  }

  return { surviving, stats };
}

function nowIso(): string {
  return new Date().toISOString();
}

function isExpired(validThrough: string | null | undefined): boolean {
  if (!validThrough) return false;
  const t = Date.parse(validThrough);
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

function isTooOld(datePosted: string, maxAgeDays: number): boolean {
  const t = Date.parse(datePosted);
  if (Number.isNaN(t)) return false;
  const ageMs = Date.now() - t;
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const target = args.limitPerVertical;
  console.log(`[scrape-vl24h] target=${target}/vertical maxAttempts=${args.maxAttemptsPerVertical} dryRun=${args.dryRun} maxAgeDays=${args.maxAgeDays ?? 'off'}`);

  console.log(`[scrape-vl24h] Fetching sitemap index...`);
  const queue = [SITEMAP_INDEX];
  const visited = new Set<string>();
  const allEntries: string[] = [];

  while (queue.length > 0) {
    const sm = queue.shift()!;
    if (visited.has(sm)) continue;
    visited.add(sm);
    await sleep(SITEMAP_DELAY_MS);
    try {
      const xml = await fetchText(sm);
      if (isSitemapIndex(xml)) {
        const children = parseSitemapIndex(xml);
        console.log(`[scrape-vl24h]   INDEX ${sm.split('/').slice(-2).join('/')}: ${children.length} children`);
        for (const c of children) queue.push(c);
      } else {
        const entries = parseSitemap(xml);
        const jobUrls = entries.filter((e) => isJobDetailUrl(e.url));
        console.log(`[scrape-vl24h]   URLSET ${sm.split('/').slice(-2).join('/')}: ${entries.length} URLs (${jobUrls.length} job-detail)`);
        for (const e of jobUrls) allEntries.push(e.url);
      }
    } catch (err) {
      console.warn(`[scrape-vl24h]   ${sm} FAILED: ${(err as Error).message}`);
    }
  }
  console.log(`[scrape-vl24h] Total job-detail URLs: ${allEntries.length}`);

  // Pre-filter BEFORE any detail fetch. KISS: cheap regex first, expensive
  // HTTP second.
  const { surviving, stats } = preFilter(allEntries);

  console.log(`\n[scrape-vl24h] === PRE-FILTER (no HTTP) ===`);
  console.log(`  total candidates:        ${stats.totalCandidates}`);
  console.log(`  rejected (no slug):      ${stats.rejectedNoSlugMatch}`);
  console.log(`  rejected (title neg):    ${stats.rejectedByTitleNeg}`);
  console.log(`  rejected (title nomatch):${stats.rejectedByTitleNoMatch}`);
  console.log(`  surviving:               ${surviving.length}`);
  for (const v of VERTICALS) {
    console.log(
      `    ${v.padEnd(10)} survived=${String(stats.perVerticalSurviving[v]).padStart(4)} ` +
        `rejNeg=${String(stats.perVerticalRejectedNeg[v]).padStart(4)} ` +
        `rejNoMatch=${String(stats.perVerticalRejectedNoMatch[v]).padStart(4)}`,
    );
  }

  // Bucket surviving URLs per vertical (preserves sitemap order)
  const buckets = {} as Record<Vertical, Bucket>;
  for (const v of VERTICALS) {
    buckets[v] = {
      vertical: v,
      urls: [],
      collected: [],
      attempts: 0,
      failures: 0,
      skippedStale: 0,
      skippedExpired: 0,
      skippedNoLd: 0,
      rejectedAtDetail: 0,
    };
  }
  for (const f of surviving) {
    buckets[f.vertical].urls.push(f);
  }

  // Detail fetch — only for filter-survivors
  for (const v of VERTICALS) {
    const bucket = buckets[v];
    console.log(`\n[scrape-vl24h] === ${v} (filter-survived=${bucket.urls.length}) ===`);

    for (const f of bucket.urls) {
      if (bucket.collected.length >= target) break;
      if (bucket.attempts >= args.maxAttemptsPerVertical) break;

      bucket.attempts++;
      await sleep(DETAIL_DELAY_MS);

      let html: string;
      try {
        html = await fetchText(f.url);
      } catch (err) {
        bucket.failures++;
        console.warn(`[scrape-vl24h]   ${v} [${bucket.attempts}] FETCH ${f.url.slice(-60)} → ${(err as Error).message}`);
        continue;
      }

      const ld = parseJobPostingLd(html);
      if (!ld) {
        bucket.skippedNoLd++;
        continue;
      }

      // Second-pass title verification on richer ld.title. URL title-slug
      // truncates at ~60 chars and loses diacritics; ld.title is the
      // authoritative form. Re-classify and override sub-vertical if
      // taxonomy refines it.
      const detailVerdict = classifyTitle(f.vertical, ld.title);
      let subVertical = f.subVertical;
      if (detailVerdict.accept) {
        subVertical = detailVerdict.subVertical;
      } else if (detailVerdict.reason === 'negative-match') {
        bucket.rejectedAtDetail++;
        continue;
      }
      // 'no-positive-match' at detail = trust the URL-slug classification
      // (filter already accepted it once); keep going.

      const input = ldToJobInput(ld, f.url, f.vertical, subVertical);
      if (!input) {
        bucket.skippedNoLd++;
        continue;
      }

      if (isExpired(input._validThrough)) {
        bucket.skippedExpired++;
        continue;
      }

      if (args.maxAgeDays !== null && isTooOld(input.postedAt, args.maxAgeDays)) {
        bucket.skippedStale++;
        continue;
      }

      bucket.collected.push(input);
      console.log(
        `[scrape-vl24h]   ${v} [${bucket.collected.length}/${target}] ✓ ` +
          `[${subVertical}] ${input.title.slice(0, 60)} @ ${input.company.slice(0, 40)}`,
      );
    }

    console.log(
      `[scrape-vl24h] ${v}: collected=${bucket.collected.length} attempts=${bucket.attempts} ` +
        `fail=${bucket.failures} noLd=${bucket.skippedNoLd} expired=${bucket.skippedExpired} ` +
        `stale=${bucket.skippedStale} rejDetail=${bucket.rejectedAtDetail}`,
    );
  }

  const allCollected: VlJobInput[] = [];
  for (const v of VERTICALS) allCollected.push(...buckets[v].collected);

  console.log(`\n[scrape-vl24h] === SUMMARY ===`);
  console.log(`Total collected: ${allCollected.length}`);
  for (const v of VERTICALS) {
    const b = buckets[v];
    const oldest = b.collected.reduce((acc, j) => (acc < j.postedAt ? acc : j.postedAt), '9999');
    console.log(
      `  ${v.padEnd(10)} collected=${String(b.collected.length).padStart(3)} ` +
        `pool=${String(b.urls.length).padStart(5)} ` +
        `oldest=${oldest === '9999' ? '-' : oldest}`,
    );
  }

  if (args.dryRun) {
    console.log(`\n[scrape-vl24h] --dry-run: skipping write`);
    return;
  }

  const outPath = args.out ?? `data/scraped-${nowIso().replace(/[:.]/g, '-')}.json`;
  const absOut = resolve(process.cwd(), outPath);
  mkdirSync(dirname(absOut), { recursive: true });

  const cleanOutput = allCollected.map(({ _validThrough: _, ...rest }) => rest);
  writeFileSync(absOut, JSON.stringify(cleanOutput, null, 2), 'utf-8');
  console.log(`\n[scrape-vl24h] Wrote ${cleanOutput.length} jobs → ${absOut}`);
}

main().catch((err) => {
  console.error('[scrape-vl24h] FATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});

// One-off audit: dump tech-slug URLs that pre-filter rejected as
// `no-positive-match`. Goal: spot missing positive patterns in
// TECH_TAXONOMY.subDomains[*].titlesPositive.
//
// Run: pnpm tsx --env-file=.env.local scripts/audit-tech-nomatch.ts
// Output: stdout (sorted unique titles) + optional --out file.

import { writeFileSync } from 'node:fs';
import {
  parseSitemapIndex,
  parseSitemap,
  extractCategorySlug,
  extractTitleSlugFromUrl,
  foldAndDeslug,
  isSitemapIndex,
  isJobDetailUrl,
} from '../src/lib/scrape/vl24h-parser';
import { classifyTitle, slugToVerticalAndSub } from '../src/lib/jobs/taxonomy';

const SITEMAP_INDEX = 'https://vieclam24h.vn/file/sitemap/sitemap-index.xml';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const SITEMAP_DELAY_MS = 600;
const FETCH_TIMEOUT_MS = 12000;

async function fetchText(url: string): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8' },
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

async function collectJobUrls(): Promise<string[]> {
  const queue = [SITEMAP_INDEX];
  const visited = new Set<string>();
  const all: string[] = [];
  while (queue.length > 0) {
    const sm = queue.shift()!;
    if (visited.has(sm)) continue;
    visited.add(sm);
    await sleep(SITEMAP_DELAY_MS);
    try {
      const xml = await fetchText(sm);
      if (isSitemapIndex(xml)) {
        for (const c of parseSitemapIndex(xml)) queue.push(c);
      } else {
        for (const e of parseSitemap(xml)) {
          if (isJobDetailUrl(e.url)) all.push(e.url);
        }
      }
    } catch (err) {
      console.warn(`[audit] sitemap ${sm} FAILED: ${(err as Error).message}`);
    }
  }
  return all;
}

interface NoMatchRow {
  slug: string;
  title: string;
  url: string;
}

async function main(): Promise<void> {
  const outArg = process.argv.indexOf('--out');
  const outPath = outArg >= 0 ? process.argv[outArg + 1] : null;

  console.log('[audit] fetching sitemap...');
  const urls = await collectJobUrls();
  console.log(`[audit] total job-detail URLs: ${urls.length}`);

  const noMatch: NoMatchRow[] = [];
  let surviving = 0;
  let rejNeg = 0;

  for (const url of urls) {
    const catSlug = extractCategorySlug(url);
    if (!catSlug) continue;
    const slugMatch = slugToVerticalAndSub('vl24h', catSlug);
    if (!slugMatch || slugMatch.vertical !== 'tech') continue;

    const titleSlug = extractTitleSlugFromUrl(url);
    if (!titleSlug) continue;
    const folded = foldAndDeslug(titleSlug);

    const verdict = classifyTitle('tech', folded, slugMatch.candidateSubDomains);
    if (verdict.accept) {
      surviving++;
      continue;
    }
    if (verdict.reason === 'negative-match') {
      rejNeg++;
      continue;
    }
    noMatch.push({ slug: catSlug, title: folded, url });
  }

  console.log(`[audit] tech survived=${surviving} rejNeg=${rejNeg} noMatch=${noMatch.length}`);

  // Group by (slug, leading token sequence) to surface clusters.
  const titleCounts = new Map<string, number>();
  for (const r of noMatch) {
    titleCounts.set(r.title, (titleCounts.get(r.title) ?? 0) + 1);
  }
  const sortedTitles = [...titleCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  console.log(`\n[audit] === tech noMatch unique titles (top 80 by frequency) ===`);
  for (const [title, n] of sortedTitles.slice(0, 80)) {
    console.log(`  ${String(n).padStart(3)}x  ${title}`);
  }

  // Group by category slug to see which IT sub-slug dominates
  const slugCounts = new Map<string, number>();
  for (const r of noMatch) slugCounts.set(r.slug, (slugCounts.get(r.slug) ?? 0) + 1);
  console.log(`\n[audit] === by category slug ===`);
  for (const [s, n] of [...slugCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}x  ${s}`);
  }

  if (outPath) {
    const lines = noMatch.map((r) => `${r.slug}\t${r.title}\t${r.url}`).join('\n');
    writeFileSync(outPath, lines, 'utf8');
    console.log(`\n[audit] wrote raw rows → ${outPath}`);
  }
}

main().catch((err) => {
  console.error('[audit] FATAL:', err);
  process.exit(1);
});

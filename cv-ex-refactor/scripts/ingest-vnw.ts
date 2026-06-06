// VietnamWorks category-driven ingest. Same shape as ingest-itviec / topcv.
//
// Listing URL pattern:  https://www.vietnamworks.com/{category-slug}
//   where {category-slug} is e.g. "viec-lam-cong-nghe-thong-tin-k1".
//   The script tolerates the slug with or without the "viec-lam-" prefix.
// Pagination:           ?page=N (Next.js boards almost always honor this)
// Detail URL pattern:   https://www.vietnamworks.com/{slug}-{id}-jv
//
// Discovery order (per research/topcv-vnw-scrape-recon.md):
//   1) JSON-LD ItemList in listing-page <head>
//   2) `<script id="__NEXT_DATA__">` JSON traversal — pull jobsByLocation or
//      similar SSR payload (VNW is Next.js).
//   3) Regex over <a href="…-{id}-jv"> fallback.
//
// Cloudflare-gated → fetchViaCurl, with the same anti-bot delays as ITviec/TopCV.

import { ingestEntries } from './ingest-file.js';
import { urlToJobInput } from './ingest-urls.js';
import { fetchViaCurl, assertCurlAvailable } from './fetch-via-curl.js';
import { extractItemListUrls } from '../src/lib/scrape/jsonld-itemlist.js';
import type { JobInput } from '../src/lib/jobs/types.js';

const LISTING_DELAY_MS = 1500;
const DETAIL_DELAY_MS = 1000;
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
 * Normalize a CLI category slug. VNW uses no .html suffix and a "k{id}" tail.
 * Accepts:
 *   viec-lam-cong-nghe-thong-tin-k1   (verbatim)
 *   cong-nghe-thong-tin-k1            (no viec-lam- prefix)
 */
export function normalizeVnwSlug(input: string): string {
  let s = input.trim().replace(/^\/+/, '');
  if (!s.startsWith('viec-lam-')) s = `viec-lam-${s}`;
  return s;
}

function buildListingUrl(slug: string, page: number): string {
  const path = normalizeVnwSlug(slug);
  return `${VNW_BASE}/${path}${page > 1 ? `?page=${page}` : ''}`;
}

// Detail URL regex fallback. VNW slugs end with `-{numeric-id}-jv`.
const VNW_DETAIL_RE = /href=["'](https?:\/\/(?:www\.)?vietnamworks\.com)?(\/[^"'\s]+-\d+-jv)["']/g;

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
  const visit = (node: unknown): void => {
    if (!node) return;
    if (typeof node === 'string') {
      // Same suffix-pattern as the HTML regex; covers absolute + relative
      // forms emitted in SSR payloads.
      const rel = /^(?:https?:\/\/(?:www\.)?vietnamworks\.com)?(\/[^"'\s]+-\d+-jv)$/;
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

      // Discovery cascade: each layer is independent; we union all hits and
      // log which path produced URLs so the operator can diagnose drift.
      let path = 'json-ld';
      let urls = extractItemListUrls(html);
      if (urls.length === 0) {
        urls = extractVnwNextDataUrls(html);
        path = '__NEXT_DATA__';
      }
      if (urls.length === 0) {
        urls = extractVnwDetailUrls(html);
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
        `[ingest vnw] discover ${cat} p${p} (${path}): parsed=${urls.length} fresh=${fresh} (cat-total=${catAdded})`,
      );
      if (urls.length < 5) break;
    }
  }
  return [...seen];
}

export async function run(args: string[]): Promise<void> {
  const { categories, pagesPerCategory, dryRun } = parseArgs(args);
  if (categories.length === 0) {
    console.error(
      '[ingest vnw] Usage: pnpm run ingest vnw <category-slug> [<slug>...] [--pages N] [--dry-run]\n' +
        '  Example: pnpm run ingest vnw cong-nghe-thong-tin-k1 ke-toan-kiem-toan-k4 --pages 3\n' +
        '  Slug forms accepted: with or without "viec-lam-" prefix.\n' +
        '  --dry-run: discover URLs only, skip detail fetch + ingest.\n' +
        '  Discover slugs from https://www.vietnamworks.com navigation menu.',
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

  const entries: JobInput[] = [];
  for (let i = 0; i < urls.length; i++) {
    if (i > 0) await sleep(DETAIL_DELAY_MS);
    const url = urls[i]!;
    console.log(`[ingest vnw] detail [${i + 1}/${urls.length}] ${url}`);
    const input = await urlToJobInput(url);
    if (input) {
      console.log(
        `[ingest vnw] detail [${i + 1}/${urls.length}] ✓ ${input.title} @ ${input.company}`,
      );
      entries.push(input);
    }
  }

  if (entries.length === 0) {
    console.error('\n[ingest vnw] No valid JobInput extracted. Nothing to ingest.');
    process.exit(1);
  }

  console.log(
    `\n[ingest vnw] ${entries.length}/${urls.length} URLs parsed. Handing off to ingest pipeline...\n`,
  );
  await ingestEntries(entries, 'ingest vnw');
}

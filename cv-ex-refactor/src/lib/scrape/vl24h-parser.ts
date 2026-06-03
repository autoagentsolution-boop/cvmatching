import type { Vertical } from '../jobs/types';

// NOTE: Vertical classification by category slug used to live here as
// SLUG_VERTICAL. It now lives in src/lib/jobs/taxonomy.ts as
// slugToVerticalAndSub(source, slug) — single source of truth shared with
// the post-ingest classifier (classify.ts). The slug list per source/sub-
// domain is the input; this module only knows how to extract the slug and
// title-slug from a vl24h URL.

export interface SitemapEntry {
  url: string;
  lastmod: string | null;
}

export interface JobPostingLd {
  title: string;
  datePosted: string | null;
  validThrough: string | null;
  description: string;
  hiringOrganization: { name: string } | null;
  jobLocation:
    | Array<{ address?: { addressLocality?: string; addressRegion?: string } }>
    | { address?: { addressLocality?: string; addressRegion?: string } }
    | null;
  baseSalary?: unknown;
  employmentType?: string | string[];
}

export function parseSitemapIndex(xml: string): string[] {
  return [...xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
}

export function parseSitemap(xml: string): SitemapEntry[] {
  const out: SitemapEntry[] = [];
  for (const m of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?[\s\S]*?<\/url>/g)) {
    out.push({ url: m[1]!, lastmod: m[2] ?? null });
  }
  return out;
}

// Match shape: https://vieclam24h.vn/<category-slug>/<title-slug>-cNNNpNNidNN.html
// Group 1 = category slug, group 2 = title slug (ASCII-folded, dash-joined).
const VL24H_DETAIL_RE = /^https?:\/\/vieclam24h\.vn\/([^/]+)\/([^/]+)-c\d+p\d+id\d+\.html$/;

export function extractCategorySlug(url: string): string | null {
  const m = url.match(VL24H_DETAIL_RE);
  return m ? m[1]! : null;
}

/**
 * Pull the title slug segment from a vl24h detail URL. Returns null if URL
 * doesn't match. The title slug is ASCII-folded (lowercased, diacritics
 * stripped, spaces → dashes) which is consumable by taxonomy regex when its
 * patterns include the folded variants alongside diacritic forms.
 */
export function extractTitleSlugFromUrl(url: string): string | null {
  const m = url.match(VL24H_DETAIL_RE);
  return m ? m[2]! : null;
}

/**
 * Convert a URL title-slug back to a space-separated phrase suitable for
 * regex matching. Does NOT restore diacritics — taxonomy patterns must
 * include the folded forms (e.g. `co khi`, `ky su`) alongside diacritic
 * forms (`cơ khí`, `kỹ sư`).
 */
export function foldAndDeslug(titleSlug: string): string {
  return titleSlug.replace(/-+/g, ' ').toLowerCase().trim();
}

export function isJobDetailUrl(url: string): boolean {
  return VL24H_DETAIL_RE.test(url);
}

export function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/.test(xml);
}

export function parseJobPostingLd(html: string): JobPostingLd | null {
  const matches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g);
  for (const m of matches) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1]!.trim());
    } catch {
      continue;
    }
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      if (item && typeof item === 'object' && (item as { '@type'?: unknown })['@type'] === 'JobPosting') {
        return item as JobPostingLd;
      }
    }
  }
  return null;
}

function flattenLocation(loc: JobPostingLd['jobLocation']): string {
  if (!loc) return '';
  const arr = Array.isArray(loc) ? loc : [loc];
  const parts: string[] = [];
  for (const entry of arr) {
    const a = entry?.address;
    if (a?.addressRegion) parts.push(a.addressRegion);
    else if (a?.addressLocality) parts.push(a.addressLocality);
  }
  return [...new Set(parts)].join(', ');
}

function stripHtmlAndNormalize(input: string): string {
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export interface VlJobInput {
  title: string;
  company: string;
  description: string;
  sourceUrl: string;
  source: 'vl24h';
  location: string;
  postedAt: string;
  vertical: Vertical;
  /** Taxonomy sub-domain id, e.g. 'tech.software'. Set when filter resolved one. */
  subVertical?: string;
  // carried for filtering, not part of Job model
  _validThrough?: string | null;
}

export function ldToJobInput(
  ld: JobPostingLd,
  sourceUrl: string,
  vertical: Vertical,
  subVertical?: string,
): VlJobInput | null {
  if (!ld.title || !ld.hiringOrganization?.name) return null;
  const desc = stripHtmlAndNormalize(ld.description || '');
  if (desc.length < 50) return null;

  const postedAt = (ld.datePosted ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);

  return {
    title: ld.title.trim(),
    company: ld.hiringOrganization.name.trim(),
    description: desc,
    sourceUrl,
    source: 'vl24h',
    location: flattenLocation(ld.jobLocation) || 'Vietnam',
    postedAt,
    vertical,
    ...(subVertical ? { subVertical } : {}),
    _validThrough: ld.validThrough ?? null,
  };
}

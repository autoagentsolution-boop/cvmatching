import type { Vertical } from '../jobs/types';

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

// vieclam24h URL category slug → our Vertical enum.
// Coverage validated against full sitemap (52 unique slugs).
//
// Tight 'tech' definition: software/IT/data only. The engineering family
// (cơ khí, điện, KH-KT, telecom) was polluting the bucket with mechanical /
// electrical / automotive / telecom roles that share the keyword "kỹ sư"
// with software engineering — a Data Engineer CV ranked against those by
// cosine sim returns mostly E-tier matches. Those slugs now route to
// 'other' until we either expand the enum or ingest enough volume to
// justify a dedicated 'engineering' bucket.
const SLUG_VERTICAL: Record<string, Vertical> = {
  'it-phan-mem': 'tech',
  'it-phan-cung-mang': 'tech',
  'phan-tich-thong-ke-du-lieu': 'tech',

  'khoa-hoc-ky-thuat': 'other',
  'co-khi-o-to-tu-dong-hoa': 'other',
  'dien-dien-tu-dien-lanh': 'other',
  'buu-chinh-vien-thong': 'other',

  marketing: 'marketing',
  'thiet-ke-sang-tao-nghe-thuat': 'marketing',
  'thong-tin-truyen-thong-quang-cao': 'marketing',
  'truyen-hinh-bao-chi-bien-tap': 'marketing',

  'ke-toan': 'finance',
  'tai-chinh-dau-tu-chung-khoan': 'finance',
  'kiem-toan': 'finance',
  'ngan-hang': 'finance',
  'bao-hiem': 'finance',

  'ban-hang-kinh-doanh': 'sales',
  'ban-si-ban-le-quan-ly-cua-hang': 'sales',
  'bat-dong-san': 'sales',

  'hanh-chinh-thu-ky': 'ops',
  'nhan-su': 'ops',
  'van-hanh-bao-tri-bao-duong': 'ops',
  'thu-mua-kho-van-chuoi-cung-ung': 'ops',
  'san-xuat-lap-rap-che-bien': 'ops',
  'quan-ly-tieu-chuan-va-chat-luong': 'ops',
  'quan-ly-du-an': 'ops',
  'van-tai-lai-xe-giao-nhan': 'ops',
  'xuat-nhap-khau': 'ops',
  'cham-soc-khach-hang': 'ops',
};

export function slugToVertical(slug: string): Vertical {
  return SLUG_VERTICAL[slug] ?? 'other';
}

const VL24H_DETAIL_RE = /^https?:\/\/vieclam24h\.vn\/([^/]+)\/[^/]+-c\d+p\d+id\d+\.html$/;

export function extractCategorySlug(url: string): string | null {
  const m = url.match(VL24H_DETAIL_RE);
  return m ? m[1]! : null;
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
  // carried for filtering, not part of Job model
  _validThrough?: string | null;
}

export function ldToJobInput(
  ld: JobPostingLd,
  sourceUrl: string,
  vertical: Vertical,
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
    _validThrough: ld.validThrough ?? null,
  };
}

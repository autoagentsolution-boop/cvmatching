// ITviec company profile parser — extracts Tier 1 facts from
// https://itviec.com/companies/{slug} pages.
//
// Verified selectors (live fetch 2026-06-05 vs FPT Software fixture):
//   - displayName: `<meta property="og:title">` content (most reliable)
//   - logoUrl:     `<meta property="og:image">` content
//   - industry / size / country: "General information" section table —
//     each cell has a label div with class `text-dark-grey ifs-xl-14`
//     containing label text, immediately followed by a sibling div with
//     the value.
//   - about: "Company overview" section — first `.paragraph` div text.
//
// Sanity guard: if <3 of 6 expected fields (displayName, industry, size,
// hq, logoUrl, about) extract → caller treats as scrape failure and mints
// stub with tier1Pending.
//
// 2026-06-10: swapped jsdom → cheerio. jsdom@29's transitive ESM dep
// (html-encoding-sniffer 6 → @exodus/bytes) breaks Vercel serverless at
// runtime. cheerio is pure-CJS and ships clean.

import * as cheerio from 'cheerio';
import { parseSizeRange } from '@/lib/companies/normalize';
import type { CompanyTier1 } from '@/lib/companies/types';

export interface ItviecParseResult {
  ok: boolean;
  fields: Partial<CompanyTier1>;
  /** Count of non-empty extracted fields out of 6 expected. ≥3 = ok. */
  fieldCount: number;
  /** Diagnostic — which expected fields landed empty. */
  missing: string[];
}

const MIN_FIELDS_OK = 3;
const EXPECTED_FIELDS = ['displayName', 'industry', 'size', 'hq', 'logoUrl', 'about'] as const;

export function parseItviecCompanyPage(html: string, sourceUrl: string): ItviecParseResult {
  const $ = cheerio.load(html);

  const fields: Partial<CompanyTier1> = { sourceUrl };

  // og:title — strip " - ITviec" / " | ITviec" trailing suffix
  const ogTitle = metaContent($, 'og:title');
  if (ogTitle) {
    fields.displayName = ogTitle.replace(/\s*[-|]\s*ITviec.*$/i, '').trim();
  }

  // og:image — direct CDN URL (Rails active_storage proxy)
  const ogImage = metaContent($, 'og:image');
  if (ogImage) fields.logoUrl = ogImage;

  // General information section — label/value pairs
  $('.text-dark-grey.ifs-xl-14').each((_, el) => {
    const $label = $(el);
    const labelText = ($label.text() ?? '').trim().toLowerCase();
    const value = nextSiblingText($label, $);
    if (!value) return;

    if (labelText === 'company industry' && !fields.industry) {
      fields.industry = value;
    } else if (labelText === 'company size' && !fields.size) {
      const bucket = parseSizeRange(value);
      if (bucket) fields.size = bucket;
    } else if (labelText === 'country' && !fields.hq) {
      fields.hq = value;
    }
  });

  // Company overview section — find h2 with "Company overview" text then
  // walk to next .paragraph sibling inside the same parent.
  const overviewHeading = $('h2').filter((_, h) =>
    ($(h).text() ?? '').trim().toLowerCase().startsWith('company overview'),
  ).first();
  if (overviewHeading.length) {
    const paragraph = overviewHeading.parent().find('.paragraph').first();
    if (paragraph.length) {
      const text = (paragraph.text() ?? '').trim();
      if (text.length >= 30) fields.about = text.slice(0, 2000);
    }
  }

  const presentFields = EXPECTED_FIELDS.filter((f) => fields[f]);
  const missing = EXPECTED_FIELDS.filter((f) => !fields[f]);

  return {
    ok: presentFields.length >= MIN_FIELDS_OK,
    fields,
    fieldCount: presentFields.length,
    missing,
  };
}

function metaContent($: cheerio.CheerioAPI, property: string): string | undefined {
  const content = $(`meta[property="${property}"]`).attr('content');
  return content?.trim() || undefined;
}

/**
 * Walk siblings to find the visible value following a label div. ITviec
 * lays out: <div class="text-dark-grey ...">Label</div> then a sibling
 * <div> with the value. Both nested inside the same col div.
 */
function nextSiblingText($label: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): string {
  const parent = $label.parent();
  if (!parent.length) return '';

  const labelText = ($label.text() ?? '').trim();
  let result = '';
  parent.children('div').each((_, child) => {
    if (result) return;
    const txt = ($(child).text() ?? '').replace(/\s+/g, ' ').trim();
    if (txt && txt !== labelText) result = txt;
  });
  return result;
}

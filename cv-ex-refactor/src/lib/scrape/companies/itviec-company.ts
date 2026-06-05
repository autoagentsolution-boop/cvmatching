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

import { JSDOM } from 'jsdom';
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
  const dom = new JSDOM(html, { url: sourceUrl });
  const doc = dom.window.document;

  const fields: Partial<CompanyTier1> = { sourceUrl };

  // og:title — strip " - ITviec" / " | ITviec" trailing suffix
  const ogTitle = metaContent(doc, 'og:title');
  if (ogTitle) {
    fields.displayName = ogTitle.replace(/\s*[-|]\s*ITviec.*$/i, '').trim();
  }

  // og:image — direct CDN URL (Rails active_storage proxy)
  const ogImage = metaContent(doc, 'og:image');
  if (ogImage) fields.logoUrl = ogImage;

  // General information section — label/value pairs
  const labels = doc.querySelectorAll('.text-dark-grey.ifs-xl-14');
  for (const label of Array.from(labels)) {
    const labelText = (label.textContent ?? '').trim().toLowerCase();
    const value = nextSiblingText(label);
    if (!value) continue;

    if (labelText === 'company industry' && !fields.industry) {
      fields.industry = value;
    } else if (labelText === 'company size' && !fields.size) {
      const bucket = parseSizeRange(value);
      if (bucket) fields.size = bucket;
    } else if (labelText === 'country' && !fields.hq) {
      fields.hq = value;
    }
  }

  // Company overview section — find h2 with "Company overview" text then
  // walk to next .paragraph sibling.
  const overviewHeading = Array.from(doc.querySelectorAll('h2')).find(
    (h) => (h.textContent ?? '').trim().toLowerCase().startsWith('company overview'),
  );
  if (overviewHeading) {
    const paragraph = overviewHeading.parentElement?.querySelector('.paragraph');
    if (paragraph) {
      const text = (paragraph.textContent ?? '').trim();
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

function metaContent(doc: Document, property: string): string | undefined {
  const el = doc.querySelector(`meta[property="${property}"]`);
  const content = el?.getAttribute('content');
  return content?.trim() || undefined;
}

/**
 * Walk DOM to find the visible value following a label div. ITviec lays
 * out: <div class="text-dark-grey ...">Label</div> then a sibling <div>
 * with the value. Both nested inside the same col div.
 */
function nextSiblingText(labelEl: Element): string {
  // The parent col contains label div + value div. Take parent's last
  // text-bearing div whose textContent ≠ label text, then strip whitespace.
  const parent = labelEl.parentElement;
  if (!parent) return '';

  const labelText = (labelEl.textContent ?? '').trim();
  const children = Array.from(parent.children).filter((c) => c.tagName === 'DIV');
  for (const child of children) {
    const txt = (child.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (txt && txt !== labelText) return txt;
  }
  return '';
}

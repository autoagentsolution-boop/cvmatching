// URL batch ingest: fetch each job posting URL, extract JSON-LD JobPosting,
// build JobInput[], hand off to the shared ingestEntries pipeline (dedup,
// classify, embed, save, resolveCompany, Tier 1 fire).
//
// Cures the manual-paste fatigue on `pnpm run ingest paste` when the operator
// has 5+ URLs from ITviec/TopCV/VNW. Sources expose schema.org JobPosting LD
// on detail pages; reuses parseJobPostingLd from vl24h-parser.

import { parseJobPostingLd, type JobPostingLd } from '../src/lib/scrape/vl24h-parser.js';
import { ingestEntries } from './ingest-file.js';
import type { Job, JobInput } from '../src/lib/jobs/types.js';

const UA = 'Mozilla/5.0 (compatible; CVMatching/0.4 ingest)';

function detectSource(url: string): Job['source'] {
  const u = url.toLowerCase();
  if (u.includes('itviec.com')) return 'itviec';
  if (u.includes('topcv.vn')) return 'topcv';
  if (u.includes('vietnamworks.com')) return 'vnw';
  if (u.includes('vieclam24h.vn')) return 'vl24h';
  return 'other';
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

function stripHtml(s: string): string {
  return s
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

async function urlToJobInput(url: string): Promise<JobInput | null> {
  let html: string;
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' } });
    if (!r.ok) {
      console.warn(`[ingest urls] HTTP ${r.status} for ${url}`);
      return null;
    }
    html = await r.text();
  } catch (err) {
    console.warn(`[ingest urls] Fetch failed for ${url}: ${err instanceof Error ? err.message : err}`);
    return null;
  }

  const ld = parseJobPostingLd(html);
  if (!ld) {
    console.warn(`[ingest urls] No JSON-LD JobPosting found at ${url}`);
    return null;
  }
  if (!ld.title || !ld.hiringOrganization?.name) {
    console.warn(`[ingest urls] LD missing title/company at ${url}`);
    return null;
  }

  // Expiry guard — drop expired postings so we never enter stale jobs into KV.
  if (ld.validThrough) {
    const exp = Date.parse(ld.validThrough);
    if (Number.isFinite(exp) && exp < Date.now()) {
      console.warn(`[ingest urls] Expired (validThrough=${ld.validThrough}): ${url}`);
      return null;
    }
  }

  const desc = stripHtml(ld.description || '');
  if (desc.length < 50) {
    console.warn(`[ingest urls] Description too short (${desc.length} chars) at ${url}`);
    return null;
  }

  const source = detectSource(url);
  const sourceCompanyUrl = ld.hiringOrganization.sameAs;

  return {
    title: ld.title.trim(),
    company: ld.hiringOrganization.name.trim(),
    description: desc,
    sourceUrl: url,
    source,
    location: flattenLocation(ld.jobLocation) || 'Vietnam',
    postedAt: (ld.datePosted ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    ...(sourceCompanyUrl ? { sourceCompanyUrl } : {}),
  };
}

export async function run(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.error('[ingest urls] Usage: pnpm run ingest urls <url> [<url> ...]');
    process.exit(1);
  }

  const entries: JobInput[] = [];
  for (let i = 0; i < args.length; i++) {
    const url = args[i]!;
    console.log(`[ingest urls] [${i + 1}/${args.length}] Fetching ${url}`);
    const input = await urlToJobInput(url);
    if (input) {
      console.log(`[ingest urls] [${i + 1}/${args.length}] Parsed: ${input.title} @ ${input.company}`);
      entries.push(input);
    }
  }

  if (entries.length === 0) {
    console.error('\n[ingest urls] No valid entries extracted. Nothing to ingest.');
    process.exit(1);
  }

  console.log(`\n[ingest urls] Parsed ${entries.length}/${args.length} URLs. Handing off to ingest pipeline...\n`);
  await ingestEntries(entries, 'ingest urls');
}

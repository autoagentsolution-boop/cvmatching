// URL batch ingest: fetch each job posting URL, extract JSON-LD JobPosting,
// build JobInput[], hand off to the shared ingestEntries pipeline (dedup,
// classify, embed, save, resolveCompany, Tier 1 fire).
//
// Cures the manual-paste fatigue on `pnpm run ingest paste` when the operator
// has 5+ URLs from ITviec/TopCV/VNW. Sources expose schema.org JobPosting LD
// on detail pages; reuses parseJobPostingLd from vl24h-parser.

import { parseJobPostingLd, type JobPostingLd } from '../src/lib/scrape/vl24h-parser.js';
import { ingestEntries } from './ingest-file.js';
import { fetchViaCurl, assertCurlAvailable } from './fetch-via-curl.js';
import type { Job, JobInput } from '../src/lib/jobs/types.js';

// Freshness cap per project_ingest_freshness_constraint: "every ingested job
// must be real + currently open + posted ≤3 days ago". Operator override via
// INGEST_MAX_AGE_DAYS env (rarely needed — pool seeding should respect the
// cap so Job Fit results stay fresh and prod KV doesn't accumulate stubs).
const MAX_AGE_DAYS = Number(process.env['INGEST_MAX_AGE_DAYS'] ?? 3);

function isTooOld(datePosted: string, maxAgeDays: number): boolean {
  const t = Date.parse(datePosted);
  if (!Number.isFinite(t)) return true; // unparseable → treat as too old
  return Date.now() - t > maxAgeDays * 24 * 60 * 60 * 1000;
}

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

export async function urlToJobInput(url: string): Promise<JobInput | null> {
  let html: string;
  try {
    const r = await fetchViaCurl(url);
    if (r.status < 200 || r.status >= 300) {
      console.warn(`[ingest urls] HTTP ${r.status} for ${url}`);
      return null;
    }
    html = r.body;
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

  // Freshness gate: reject when datePosted is missing OR older than the cap.
  // Previously fell back to today's date — silent freshness bypass that would
  // let stale jobs leak into the active pool. Per
  // feedback_error_surfacing_no_silent_fallback this now surfaces.
  const datePostedRaw = (ld.datePosted ?? '').slice(0, 10);
  if (!datePostedRaw) {
    console.warn(`[ingest urls] No datePosted in JSON-LD (freshness unverifiable): ${url}`);
    return null;
  }
  if (isTooOld(datePostedRaw, MAX_AGE_DAYS)) {
    console.warn(`[ingest urls] Too old (datePosted=${datePostedRaw}, cap=${MAX_AGE_DAYS}d): ${url}`);
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
    postedAt: datePostedRaw,
    ...(sourceCompanyUrl ? { sourceCompanyUrl } : {}),
  };
}

export async function run(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.error('[ingest urls] Usage: pnpm run ingest urls <url> [<url> ...]');
    process.exit(1);
  }

  await assertCurlAvailable();

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

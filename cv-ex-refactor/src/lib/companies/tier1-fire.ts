// Orchestrator for the Tier 1 scrape-then-update side effect.
// Called best-effort from ingest pipelines AFTER resolveCompany returns
// a slug. Failures log + return false; never throw — the Job ingest must
// not abort because a company-page fetch had a hiccup.
//
// Decides whether to fire:
//   - resolved.created = true (new company) → ALWAYS fire
//   - existing company with tier1Pending = true → fire (previous attempt failed)
//   - existing company with tier1ExpiresAt past → fire (refresh)
//   - else → skip (Tier 1 fresh, nothing to do)

import { fetchHtml } from '@/lib/scrape/fetch-html';
import { scrapeCompanyPage } from '@/lib/scrape/companies';
import { getCompany, mergeTier1Fields } from './kv-client';
import type { Job } from '@/lib/jobs/types';

export interface Tier1FireOpts {
  source: Job['source'];
  sourceCompanyUrl: string;
  slug: string;
  /** Result from resolveCompany — used to decide whether to fire on first ingest. */
  created: boolean;
}

export interface Tier1FireResult {
  fired: boolean;
  skipped?: 'fresh' | 'no-url' | 'not-itviec';
  ok?: boolean;
  reason?: string;
  fieldCount?: number;
}

export async function fireTier1Scrape(opts: Tier1FireOpts): Promise<Tier1FireResult> {
  if (opts.source !== 'itviec') {
    return { fired: false, skipped: 'not-itviec' };
  }
  if (!opts.sourceCompanyUrl) {
    return { fired: false, skipped: 'no-url' };
  }

  const existing = opts.created ? null : await getCompany(opts.slug);
  const shouldFire =
    opts.created ||
    (existing?.tier1.pending ?? false) ||
    isStale(existing?.tier1ExpiresAt);

  if (!shouldFire) {
    return { fired: false, skipped: 'fresh' };
  }

  let html: string;
  try {
    const fetched = await fetchHtml(new URL(opts.sourceCompanyUrl));
    html = fetched.html;
  } catch (err) {
    return {
      fired: true,
      ok: false,
      reason: `fetch failed: ${err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120)}`,
    };
  }

  const parsed = scrapeCompanyPage(opts.source, html, opts.sourceCompanyUrl);
  if (!parsed.ok) {
    return {
      fired: true,
      ok: false,
      reason: parsed.message ?? parsed.reason ?? 'parse failed',
      ...(parsed.fieldCount !== undefined ? { fieldCount: parsed.fieldCount } : {}),
    };
  }

  await mergeTier1Fields(opts.slug, parsed.fields ?? {});
  return { fired: true, ok: true, ...(parsed.fieldCount !== undefined ? { fieldCount: parsed.fieldCount } : {}) };
}

function isStale(expiresAt: string | undefined): boolean {
  if (!expiresAt) return true;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return true;
  return t < Date.now();
}

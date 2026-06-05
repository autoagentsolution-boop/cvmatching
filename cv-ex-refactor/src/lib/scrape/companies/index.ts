// Source-aware dispatcher for company-page scraping (Tier 1 facts).
// Only ITviec implemented in Phase 02 lite. TopCV/VNW/VL24H stub
// `parser-not-implemented` — caller treats as scrape failure and mints
// a stub Company with `tier1Pending: true` so next ingest pass retries
// (idempotent once a real parser lands).
//
// Caller responsibilities (Phase 02 ingest wiring):
//   1. Polite single-GET via fetch-html.ts; capture status + body.
//   2. Call this dispatcher with html + sourceUrl + source.
//   3. On `ok: true` → updateCompany(slug, fields, tier1ExpiresAt = now+90d).
//   4. On `ok: false` → log reason, set tier1Pending=true, fire next-retry.

import { parseItviecCompanyPage } from './itviec-company';
import type { Job } from '@/lib/jobs/types';
import type { CompanyTier1 } from '@/lib/companies/types';

export interface ScrapeCompanyResult {
  ok: boolean;
  /** Populated only when ok=true. Partial CompanyTier1; merge into existing Company. */
  fields?: Partial<CompanyTier1>;
  /** Diagnostic — count of non-empty fields extracted (parser sanity guard). */
  fieldCount?: number;
  reason?:
    | 'parser-not-implemented'
    | 'insufficient-fields'
    | 'parser-error'
    | 'empty-html';
  message?: string;
}

export function scrapeCompanyPage(
  source: Job['source'],
  html: string,
  sourceUrl: string,
): ScrapeCompanyResult {
  if (!html || html.length < 100) {
    return { ok: false, reason: 'empty-html', message: `HTML too short: ${html.length} bytes` };
  }

  switch (source) {
    case 'itviec': {
      try {
        const result = parseItviecCompanyPage(html, sourceUrl);
        if (!result.ok) {
          return {
            ok: false,
            reason: 'insufficient-fields',
            message: `Only ${result.fieldCount}/6 fields extracted (missing: ${result.missing.join(', ')})`,
            fieldCount: result.fieldCount,
            fields: result.fields,
          };
        }
        return { ok: true, fields: result.fields, fieldCount: result.fieldCount };
      } catch (e) {
        return {
          ok: false,
          reason: 'parser-error',
          message: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200),
        };
      }
    }
    case 'topcv':
    case 'vnw':
    case 'vl24h':
    case 'other':
      return {
        ok: false,
        reason: 'parser-not-implemented',
        message: `Parser for source '${source}' deferred to next session (Phase 02 lite ships ITviec only)`,
      };
  }
}

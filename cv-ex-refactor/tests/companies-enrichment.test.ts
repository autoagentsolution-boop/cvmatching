// Tests for Tier 2 enrichment — parser robustness + insufficient-source
// defamation guard. Pure logic, no live LLM. Orchestrator integration tested
// manually via scripts/smoke-company-enrich.ts (separate, burns Gemini quota).

import { describe, it, expect } from 'vitest';
import {
  parseEnrichmentResponse,
  applyInsufficientSourceGuard,
  isEnrichmentStale,
} from '@/lib/companies/enrichment';
import type { CompanyEnrichment } from '@/lib/companies/types';

const VALID_RESPONSE = {
  summary: 'Công ty A là nhà cung cấp dịch vụ X tại Việt Nam.',
  pros: [
    {
      text: 'Theo Báo Y, công ty được vinh danh top 10 ngành.',
      citations: [{ title: 'Báo Y top 10', url: 'https://example.com/top10' }],
    },
  ],
  cons: [
    {
      text: 'Theo Glassdoor + Indeed, có ý kiến phản ánh về overtime.',
      citations: [
        { title: 'Glassdoor review', url: 'https://glassdoor.com/review/a' },
        { title: 'Indeed review', url: 'https://indeed.com/cmp/a/reviews' },
      ],
    },
  ],
  sourceCount: 4,
};

describe('parseEnrichmentResponse', () => {
  it('parses well-formed JSON', () => {
    const r = parseEnrichmentResponse(JSON.stringify(VALID_RESPONSE));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.summary).toContain('Công ty A');
      expect(r.data.pros).toHaveLength(1);
      expect(r.data.cons).toHaveLength(1);
    }
  });

  it('parses JSON wrapped in markdown fence', () => {
    const raw = '```json\n' + JSON.stringify(VALID_RESPONSE) + '\n```';
    expect(parseEnrichmentResponse(raw).ok).toBe(true);
  });

  it('returns parse_failed on malformed JSON', () => {
    const r = parseEnrichmentResponse('not json at all');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('parse_failed');
      expect(r.status).toBe(502);
    }
  });

  it('returns invalid_shape when sourceCount missing', () => {
    const { sourceCount: _drop, ...rest } = VALID_RESPONSE;
    const r = parseEnrichmentResponse(JSON.stringify(rest));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('invalid_shape');
  });

  it('returns invalid_shape when citation url malformed', () => {
    const bad = {
      ...VALID_RESPONSE,
      pros: [{ text: 'x', citations: [{ title: 't', url: 'not-a-url' }] }],
    };
    expect(parseEnrichmentResponse(JSON.stringify(bad)).ok).toBe(false);
  });

  it('returns invalid_shape when pros item has zero citations', () => {
    const bad = {
      ...VALID_RESPONSE,
      pros: [{ text: 'x', citations: [] }],
    };
    expect(parseEnrichmentResponse(JSON.stringify(bad)).ok).toBe(false);
  });

  it('caps pros + cons at 4 entries each', () => {
    const tooMany = {
      ...VALID_RESPONSE,
      pros: Array.from({ length: 5 }, (_, i) => ({
        text: `p${i}`,
        citations: [{ title: 't', url: 'https://x.com/a' }],
      })),
    };
    expect(parseEnrichmentResponse(JSON.stringify(tooMany)).ok).toBe(false);
  });

  it('accepts empty pros + cons arrays (valid no-info response)', () => {
    const empty = { summary: '', pros: [], cons: [], sourceCount: 0 };
    const r = parseEnrichmentResponse(JSON.stringify(empty));
    expect(r.ok).toBe(true);
  });
});

describe('applyInsufficientSourceGuard — defamation gate', () => {
  it('keeps summary + pros when sourceCount ≥ 2', () => {
    const r = applyInsufficientSourceGuard(VALID_RESPONSE);
    expect(r.summary).toContain('Công ty A');
    expect(r.pros).toHaveLength(1);
    expect(r.insufficientSources).toBeUndefined();
  });

  it('blanks summary when sourceCount < 2 + sets insufficientSources flag', () => {
    const r = applyInsufficientSourceGuard({ ...VALID_RESPONSE, sourceCount: 1 });
    expect(r.summary).toBe('');
    expect(r.insufficientSources).toBe(true);
  });

  it('drops cons items with <2 citations', () => {
    const r = applyInsufficientSourceGuard({
      ...VALID_RESPONSE,
      cons: [
        {
          text: 'one-citation con — should be dropped',
          citations: [{ title: 't', url: 'https://x.com/a' }],
        },
        {
          text: 'two-citation con — should survive',
          citations: [
            { title: 'src1', url: 'https://x.com/a' },
            { title: 'src2', url: 'https://x.com/b' },
          ],
        },
      ],
    });
    expect(r.cons).toHaveLength(1);
    expect(r.cons[0]?.text).toContain('should survive');
  });

  it('keeps pros with single citation (less defamation risk)', () => {
    const r = applyInsufficientSourceGuard({
      ...VALID_RESPONSE,
      pros: [
        {
          text: 'single-citation pro — survives',
          citations: [{ title: 't', url: 'https://x.com/a' }],
        },
      ],
    });
    expect(r.pros).toHaveLength(1);
  });

  it('maps citations.title → CitationChip.label, falls back to hostname', () => {
    const r = applyInsufficientSourceGuard({
      ...VALID_RESPONSE,
      pros: [
        {
          text: 'pro with empty title citation',
          citations: [{ title: '', url: 'https://www.example.com/path' }],
        },
      ],
    });
    // safeHostname strips `www.` prefix for cleaner labels
    expect(r.pros[0]?.citations[0]?.label).toBe('example.com');
  });

  it('always stamps enrichedAt ISO timestamp', () => {
    const r = applyInsufficientSourceGuard(VALID_RESPONSE);
    expect(r.enrichedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Date.parse(r.enrichedAt)).not.toBeNaN();
  });
});

describe('isEnrichmentStale — 30d window', () => {
  const stub = (enrichedAt: string): CompanyEnrichment => ({
    summary: '',
    pros: [],
    cons: [],
    enrichedAt,
  });

  it('returns true when enrichment undefined', () => {
    expect(isEnrichmentStale(undefined)).toBe(true);
  });

  it('returns false for fresh enrichment (today)', () => {
    expect(isEnrichmentStale(stub(new Date().toISOString()))).toBe(false);
  });

  it('returns true for 31-day-old enrichment', () => {
    const old = new Date(Date.now() - 31 * 86_400_000).toISOString();
    expect(isEnrichmentStale(stub(old))).toBe(true);
  });

  it('returns false for 29-day-old enrichment', () => {
    const fresh = new Date(Date.now() - 29 * 86_400_000).toISOString();
    expect(isEnrichmentStale(stub(fresh))).toBe(false);
  });

  it('returns true for malformed timestamp', () => {
    expect(isEnrichmentStale(stub('not-a-date'))).toBe(true);
  });
});

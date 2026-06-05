// CompanyCard pure-helper tests. Component visual states verified via
// manual dev smoke (RTL not installed in project, vitest is node-env).
// These tests guard the conditional-render decision logic:
//   - isAllTier1Empty: triggers CompanyCardEmpty branch
//   - isTier1Stale + daysSince: drives "Cập nhật Nd ago" stamp
//   - isSafeHttpUrl: guards logo + website href
//   - prettyDomain: website display

import { describe, it, expect } from 'vitest';
import {
  isAllTier1Empty,
  isTier1Stale,
  daysSince,
  isSafeHttpUrl,
  prettyDomain,
} from '@/features/job-fit/company-card';
import type { Company } from '@/lib/companies/types';

const baseCompany = (tier1: Partial<Company['tier1']>): Company => ({
  slug: 'test',
  canonicalName: 'test co',
  tier1: {
    sourceUrl: 'https://example.com',
    displayName: 'Test Co',
    ...tier1,
  },
  tier1FetchedAt: '2026-06-01T00:00:00.000Z',
  tier1ExpiresAt: '2026-09-01T00:00:00.000Z',
  createdAt: '2026-06-01T00:00:00.000Z',
});

describe('isAllTier1Empty', () => {
  it('returns true when industry, size, hq, website, logoUrl, about all absent', () => {
    expect(isAllTier1Empty(baseCompany({}))).toBe(true);
  });

  it('returns false when industry present', () => {
    expect(isAllTier1Empty(baseCompany({ industry: 'IT' }))).toBe(false);
  });

  it('returns false when size present', () => {
    expect(isAllTier1Empty(baseCompany({ size: '201-1000' }))).toBe(false);
  });

  it('returns false when hq present', () => {
    expect(isAllTier1Empty(baseCompany({ hq: 'Vietnam' }))).toBe(false);
  });

  it('returns false when only logoUrl present', () => {
    expect(isAllTier1Empty(baseCompany({ logoUrl: 'https://x.com/a.png' }))).toBe(false);
  });

  it('returns false when only about present', () => {
    expect(isAllTier1Empty(baseCompany({ about: 'A leading provider...' }))).toBe(false);
  });
});

describe('isTier1Stale', () => {
  it('returns false for future expiry', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(isTier1Stale(future)).toBe(false);
  });

  it('returns true for past expiry', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(isTier1Stale(past)).toBe(true);
  });

  it('returns false for undefined input', () => {
    expect(isTier1Stale(undefined)).toBe(false);
  });

  it('returns false for malformed timestamp', () => {
    expect(isTier1Stale('not-a-date')).toBe(false);
  });
});

describe('daysSince', () => {
  it('returns 0 for undefined input', () => {
    expect(daysSince(undefined)).toBe(0);
  });

  it('returns 0 for malformed timestamp', () => {
    expect(daysSince('not-a-date')).toBe(0);
  });

  it('clamps negative differences (future timestamps) to 0', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(daysSince(future)).toBe(0);
  });

  it('approx counts day-deltas (7-day-ago timestamp ≥ 6 and ≤ 8 days)', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const d = daysSince(sevenDaysAgo);
    expect(d).toBeGreaterThanOrEqual(6);
    expect(d).toBeLessThanOrEqual(8);
  });
});

describe('isSafeHttpUrl', () => {
  it('accepts https', () => {
    expect(isSafeHttpUrl('https://example.com')).toBe(true);
  });

  it('accepts http', () => {
    expect(isSafeHttpUrl('http://example.com')).toBe(true);
  });

  it('rejects javascript: scheme', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: scheme', () => {
    expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejects file: scheme', () => {
    expect(isSafeHttpUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects malformed URL', () => {
    expect(isSafeHttpUrl('not a url')).toBe(false);
    expect(isSafeHttpUrl('')).toBe(false);
  });
});

describe('prettyDomain', () => {
  it('strips www. prefix', () => {
    expect(prettyDomain('https://www.fpt-software.com/about')).toBe('fpt-software.com');
  });

  it('keeps subdomains other than www', () => {
    expect(prettyDomain('https://careers.google.com')).toBe('careers.google.com');
  });

  it('handles http(s) protocol', () => {
    expect(prettyDomain('http://example.com')).toBe('example.com');
    expect(prettyDomain('https://example.com')).toBe('example.com');
  });

  it('returns raw on malformed URL', () => {
    expect(prettyDomain('not-a-url')).toBe('not-a-url');
  });
});

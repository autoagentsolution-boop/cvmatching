// ITviec company parser tests — fixture-based, no live fetch.
// Fixture: tests/fixtures/companies/itviec-fpt-software.html
// Captured 2026-06-05 via polite single-GET. Selectors drift may break
// these tests; re-fetch fixture + adjust parser when ITviec redesigns.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseItviecCompanyPage } from '@/lib/scrape/companies/itviec-company';

let html: string;

beforeAll(() => {
  html = readFileSync(
    join(process.cwd(), 'tests/fixtures/companies/itviec-fpt-software.html'),
    'utf-8',
  );
});

describe('parseItviecCompanyPage — FPT Software fixture', () => {
  const url = 'https://itviec.com/companies/fpt-software';

  it('reports ok=true with ≥3 fields', () => {
    const result = parseItviecCompanyPage(html, url);
    expect(result.ok).toBe(true);
    expect(result.fieldCount).toBeGreaterThanOrEqual(3);
  });

  it('extracts displayName (strips ITviec suffix)', () => {
    const { fields } = parseItviecCompanyPage(html, url);
    expect(fields.displayName).toContain('FPT Software');
    expect(fields.displayName).not.toMatch(/itviec/i);
  });

  it('extracts industry (Company industry label → value)', () => {
    const { fields } = parseItviecCompanyPage(html, url);
    expect(fields.industry).toBe('IT Services and IT Consulting');
  });

  it('extracts size bucket via parseSizeRange', () => {
    const { fields } = parseItviecCompanyPage(html, url);
    // FPT Software fixture shows "1000+ employees" → 201-1000 bucket
    expect(fields.size).toBe('201-1000');
  });

  it('extracts hq (Country label)', () => {
    const { fields } = parseItviecCompanyPage(html, url);
    expect(fields.hq).toContain('Vietnam');
  });

  it('extracts logoUrl from og:image meta', () => {
    const { fields } = parseItviecCompanyPage(html, url);
    expect(fields.logoUrl).toBeDefined();
    expect(fields.logoUrl).toMatch(/^https:\/\/itviec\.com\//);
  });

  it('extracts about (Company overview section)', () => {
    const { fields } = parseItviecCompanyPage(html, url);
    expect(fields.about).toBeDefined();
    expect(fields.about?.length).toBeGreaterThan(50);
    expect(fields.about).toMatch(/FPT|software|technology/i);
  });

  it('preserves sourceUrl', () => {
    const { fields } = parseItviecCompanyPage(html, url);
    expect(fields.sourceUrl).toBe(url);
  });
});

describe('parseItviecCompanyPage — degraded input', () => {
  const url = 'https://itviec.com/companies/empty';

  it('reports ok=false when <3 fields extracted from minimal HTML', () => {
    const minimal = '<html><head></head><body><h1>Nothing</h1></body></html>';
    const result = parseItviecCompanyPage(minimal, url);
    expect(result.ok).toBe(false);
    expect(result.fieldCount).toBeLessThan(3);
    expect(result.missing.length).toBeGreaterThanOrEqual(4);
  });

  it('still populates sourceUrl on degraded input', () => {
    const { fields } = parseItviecCompanyPage('<html></html>', url);
    expect(fields.sourceUrl).toBe(url);
  });

  it('extracts displayName-only from minimal HTML with og:title', () => {
    const html = `<html><head><meta property="og:title" content="Acme Co - ITviec"></head><body></body></html>`;
    const { fields, ok } = parseItviecCompanyPage(html, url);
    expect(fields.displayName).toBe('Acme Co');
    expect(ok).toBe(false); // only 1 field, below MIN_FIELDS_OK
  });
});

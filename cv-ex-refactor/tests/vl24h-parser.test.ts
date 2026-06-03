// Unit tests for vl24h URL parsing helpers used by the Phase-2 pre-filter.
// Detail-page HTML parsing is exercised indirectly via the scrape script;
// these tests focus on the cheap-and-pure URL slug extractors.

import { describe, it, expect } from 'vitest';
import {
  extractCategorySlug,
  extractTitleSlugFromUrl,
  foldAndDeslug,
  isJobDetailUrl,
} from '@/lib/scrape/vl24h-parser';

const SAMPLE_URLS = {
  software:
    'https://vieclam24h.vn/it-phan-mem/senior-backend-engineer-nodejs-c123p4567id89.html',
  mechEngineer:
    'https://vieclam24h.vn/co-khi-o-to-tu-dong-hoa/ky-su-co-khi-thiet-ke-c100p200id300.html',
  sales:
    'https://vieclam24h.vn/ban-hang-kinh-doanh/nhan-vien-kinh-doanh-b2b-c11p22id33.html',
  malformed: 'https://vieclam24h.vn/missing-slug-parts.html',
  notADetail: 'https://vieclam24h.vn/it-phan-mem',
};

describe('isJobDetailUrl', () => {
  it('accepts canonical vl24h detail URL', () => {
    expect(isJobDetailUrl(SAMPLE_URLS.software)).toBe(true);
  });
  it('rejects category index URL', () => {
    expect(isJobDetailUrl(SAMPLE_URLS.notADetail)).toBe(false);
  });
  it('rejects malformed paths', () => {
    expect(isJobDetailUrl(SAMPLE_URLS.malformed)).toBe(false);
  });
});

describe('extractCategorySlug', () => {
  it('returns IT category slug', () => {
    expect(extractCategorySlug(SAMPLE_URLS.software)).toBe('it-phan-mem');
  });
  it('returns mechanical engineering category slug', () => {
    expect(extractCategorySlug(SAMPLE_URLS.mechEngineer)).toBe('co-khi-o-to-tu-dong-hoa');
  });
  it('returns null for non-detail URL', () => {
    expect(extractCategorySlug(SAMPLE_URLS.notADetail)).toBeNull();
  });
});

describe('extractTitleSlugFromUrl', () => {
  it('returns title slug between category and trailing id segment', () => {
    expect(extractTitleSlugFromUrl(SAMPLE_URLS.software)).toBe('senior-backend-engineer-nodejs');
  });
  it('returns VN-folded title slug for mechanical role', () => {
    expect(extractTitleSlugFromUrl(SAMPLE_URLS.mechEngineer)).toBe('ky-su-co-khi-thiet-ke');
  });
  it('returns null for malformed URL', () => {
    expect(extractTitleSlugFromUrl(SAMPLE_URLS.malformed)).toBeNull();
  });
});

describe('foldAndDeslug', () => {
  it('replaces dashes with single spaces', () => {
    expect(foldAndDeslug('senior-backend-engineer-nodejs')).toBe('senior backend engineer nodejs');
  });
  it('lowercases mixed-case slugs', () => {
    expect(foldAndDeslug('Senior-Backend-Engineer')).toBe('senior backend engineer');
  });
  it('collapses runs of dashes to one space', () => {
    expect(foldAndDeslug('ky-su--co--khi')).toBe('ky su co khi');
  });
  it('trims edge whitespace from stray dashes', () => {
    expect(foldAndDeslug('-edge-case-')).toBe('edge case');
  });
});

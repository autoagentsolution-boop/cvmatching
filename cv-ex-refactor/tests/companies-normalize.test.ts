// Unit tests for company-name + location normalization.
// Pure logic — no KV, no LLM. Fast suite, runs on every change.
// Phase 01 acceptance: 30+ VN-name variants normalize consistently.

import { describe, it, expect } from 'vitest';
import {
  normalizeCompanyName,
  companyNameToSlug,
  normalizeLocation,
  nameSimilarity,
  parseSizeRange,
} from '@/lib/companies/normalize';

describe('normalizeCompanyName — VN legal suffix stripping', () => {
  it('strips "Công ty" prefix variants', () => {
    expect(normalizeCompanyName('Công ty FPT')).toBe('fpt');
    expect(normalizeCompanyName('Cong ty FPT')).toBe('fpt');
    expect(normalizeCompanyName('Cty FPT')).toBe('fpt');
    expect(normalizeCompanyName('Cty. FPT')).toBe('fpt');
  });

  it('strips TNHH + MTV variants', () => {
    expect(normalizeCompanyName('Công ty TNHH FPT Software')).toBe('fpt software');
    expect(normalizeCompanyName('Cty TNHH MTV ABC')).toBe('abc');
    expect(normalizeCompanyName('TNHH XYZ')).toBe('xyz');
  });

  it('strips "Cổ phần" + JSC variants', () => {
    expect(normalizeCompanyName('Công ty Cổ phần FPT')).toBe('fpt');
    expect(normalizeCompanyName('FPT JSC')).toBe('fpt');
    expect(normalizeCompanyName('FPT J.S.C.')).toBe('fpt');
    expect(normalizeCompanyName('Cong ty Co phan ABC')).toBe('abc');
  });

  it('strips English forms — Inc, Corp, Ltd, LLC, GmbH', () => {
    expect(normalizeCompanyName('FPT Inc.')).toBe('fpt');
    expect(normalizeCompanyName('FPT Corp.')).toBe('fpt');
    expect(normalizeCompanyName('FPT Corporation')).toBe('fpt');
    expect(normalizeCompanyName('FPT, Ltd.')).toBe('fpt');
    expect(normalizeCompanyName('FPT Limited')).toBe('fpt');
    expect(normalizeCompanyName('FPT LLC')).toBe('fpt');
    expect(normalizeCompanyName('FPT GmbH')).toBe('fpt');
    expect(normalizeCompanyName('Co., Ltd. FPT')).toBe('fpt');
  });

  it('strips Asian regional forms — Pte Ltd, Pvt Ltd', () => {
    expect(normalizeCompanyName('FPT Pte. Ltd.')).toBe('fpt');
    expect(normalizeCompanyName('FPT Pvt Ltd')).toBe('fpt');
  });

  it('preserves distinguishing brand modifiers', () => {
    expect(normalizeCompanyName('FPT Software')).toBe('fpt software');
    expect(normalizeCompanyName('FPT Telecom')).toBe('fpt telecom');
    expect(normalizeCompanyName('FPT')).toBe('fpt');
    // Holdings + Group preserved — they distinguish VN entities (separate
    // companies, different LLM enrichment surfaces). See normalize.ts comment.
    expect(normalizeCompanyName('FPT Holdings')).toBe('fpt holdings');
    expect(normalizeCompanyName('FPT Group')).toBe('fpt group');
  });

  it('preserves VN diacritics and digits', () => {
    expect(normalizeCompanyName('Đông Á Bank')).toBe('đông á bank');
    expect(normalizeCompanyName('FPT 3S')).toBe('fpt 3s');
    expect(normalizeCompanyName('Tech 24/7')).toBe('tech 24 7');
  });

  it('handles whitespace + punctuation noise', () => {
    expect(normalizeCompanyName('  FPT  ')).toBe('fpt');
    expect(normalizeCompanyName('FPT-Software')).toBe('fpt software');
    expect(normalizeCompanyName('FPT, Software!')).toBe('fpt software');
    expect(normalizeCompanyName('FPT  Software')).toBe('fpt software');
  });

  it('handles edge cases — empty, all-suffix, single char', () => {
    expect(normalizeCompanyName('')).toBe('');
    expect(normalizeCompanyName('   ')).toBe('');
    expect(normalizeCompanyName('Công ty TNHH')).toBe('');
    expect(normalizeCompanyName('A')).toBe('a');
  });

  it('case-insensitive suffix matching', () => {
    expect(normalizeCompanyName('FPT JSC')).toBe('fpt');
    expect(normalizeCompanyName('FPT jsc')).toBe('fpt');
    expect(normalizeCompanyName('FPT Jsc')).toBe('fpt');
    expect(normalizeCompanyName('CÔNG TY FPT')).toBe('fpt');
  });
});

describe('companyNameToSlug — URL-safe identifier', () => {
  it('strips diacritics + maps đ→d', () => {
    expect(companyNameToSlug('Đông Á Bank')).toBe('dong-a-bank');
    expect(companyNameToSlug('Việt Nam Software')).toBe('viet-nam-software');
  });

  it('produces stable kebab-case', () => {
    expect(companyNameToSlug('FPT Software')).toBe('fpt-software');
    expect(companyNameToSlug('FPT   Software')).toBe('fpt-software');
    expect(companyNameToSlug('FPT_Software')).toBe('fpt-software');
  });

  it('caps at 60 chars', () => {
    const long = 'A'.repeat(100) + ' Software';
    const slug = companyNameToSlug(long);
    expect(slug.length).toBeLessThanOrEqual(60);
  });

  it('preserves dash separators within 60-char window', () => {
    const slug = companyNameToSlug('FPT Software Vietnam');
    expect(slug).toBe('fpt-software-vietnam');
  });

  it('strips leading/trailing dashes', () => {
    expect(companyNameToSlug('--FPT--')).toBe('fpt');
    expect(companyNameToSlug('!!FPT!!')).toBe('fpt');
  });

  it('handles empty + all-punctuation', () => {
    expect(companyNameToSlug('')).toBe('');
    expect(companyNameToSlug('!@#$%')).toBe('');
  });
});

describe('normalizeLocation — VN city alias map', () => {
  it('maps HCMC variants to "ho chi minh city"', () => {
    expect(normalizeLocation('HCMC')).toBe('ho chi minh city');
    expect(normalizeLocation('HCM')).toBe('ho chi minh city');
    expect(normalizeLocation('Ho Chi Minh')).toBe('ho chi minh city');
    expect(normalizeLocation('Hồ Chí Minh')).toBe('ho chi minh city');
    expect(normalizeLocation('Saigon')).toBe('ho chi minh city');
    expect(normalizeLocation('Sài Gòn')).toBe('ho chi minh city');
    expect(normalizeLocation('TPHCM')).toBe('ho chi minh city');
    expect(normalizeLocation('TP HCM')).toBe('ho chi minh city');
  });

  it('maps Hanoi variants', () => {
    expect(normalizeLocation('Hanoi')).toBe('hanoi');
    expect(normalizeLocation('Hà Nội')).toBe('hanoi');
    expect(normalizeLocation('Ha Noi')).toBe('hanoi');
  });

  it('maps Da Nang variants', () => {
    expect(normalizeLocation('Da Nang')).toBe('da nang');
    expect(normalizeLocation('Đà Nẵng')).toBe('da nang');
    expect(normalizeLocation('Danang')).toBe('da nang');
  });

  it('strips comma + extra whitespace', () => {
    expect(normalizeLocation('Ho Chi Minh, Vietnam')).toBe('ho chi minh city');
    expect(normalizeLocation('  HCMC  ')).toBe('ho chi minh city');
  });

  it('passes through unknown cities lowercased + diacritic-stripped', () => {
    expect(normalizeLocation('Bangkok')).toBe('bangkok');
    expect(normalizeLocation('Singapore')).toBe('singapore');
  });
});

describe('parseSizeRange — VN+EN phrasings', () => {
  it('plus suffix (1000+, 5000+)', () => {
    expect(parseSizeRange('1000+')).toBe('201-1000');
    expect(parseSizeRange('1000+ employees')).toBe('201-1000');
    expect(parseSizeRange('1000+ nhân viên')).toBe('201-1000');
    expect(parseSizeRange('5000+')).toBe('1001-5000');
    expect(parseSizeRange('10000+')).toBe('5000+');
    expect(parseSizeRange('10,000+')).toBe('5000+');
  });

  it('numeric ranges (100-499, 501-1000, 10-24)', () => {
    expect(parseSizeRange('10-24')).toBe('1-50');
    expect(parseSizeRange('25-99 employees')).toBe('51-200');
    expect(parseSizeRange('100-499 nhân viên')).toBe('201-1000');
    expect(parseSizeRange('501 - 1000 employees')).toBe('201-1000');
    expect(parseSizeRange('1001-5000')).toBe('1001-5000');
  });

  it('range with em-dash / en-dash variants', () => {
    expect(parseSizeRange('100–499')).toBe('201-1000');
    expect(parseSizeRange('100—499')).toBe('201-1000');
    expect(parseSizeRange('100 to 499')).toBe('201-1000');
  });

  it('under-N phrasings', () => {
    expect(parseSizeRange('Less than 10')).toBe('1-50');
    expect(parseSizeRange('Under 10 employees')).toBe('1-50');
    expect(parseSizeRange('Dưới 10')).toBe('1-50');
    expect(parseSizeRange('duoi 10 nhan vien')).toBe('1-50');
  });

  it('5-bucket boundary mapping', () => {
    expect(parseSizeRange('50')).toBe('1-50');
    expect(parseSizeRange('51')).toBe('51-200');
    expect(parseSizeRange('200')).toBe('51-200');
    expect(parseSizeRange('201')).toBe('201-1000');
    expect(parseSizeRange('1000')).toBe('201-1000');
    expect(parseSizeRange('1001')).toBe('1001-5000');
    expect(parseSizeRange('5000')).toBe('1001-5000');
    expect(parseSizeRange('5001')).toBe('5000+');
  });

  it('empty + unparseable → undefined', () => {
    expect(parseSizeRange('')).toBeUndefined();
    expect(parseSizeRange('not a number')).toBeUndefined();
    expect(parseSizeRange('unknown')).toBeUndefined();
  });
});

describe('nameSimilarity — Jaccard pre-LLM gate', () => {
  it('identical normalized forms = 1', () => {
    expect(nameSimilarity('FPT Software', 'FPT Software')).toBe(1);
    expect(nameSimilarity('Công ty FPT', 'FPT')).toBe(1);
  });

  it('shares all major tokens = ~1', () => {
    expect(nameSimilarity('FPT Software', 'Cty FPT Software')).toBeGreaterThanOrEqual(0.95);
  });

  it('partial overlap = mid-range', () => {
    const s = nameSimilarity('FPT Software', 'FPT Telecom');
    expect(s).toBeGreaterThan(0.2);
    expect(s).toBeLessThan(0.6);
  });

  it('no overlap = 0', () => {
    expect(nameSimilarity('FPT', 'Google')).toBe(0);
  });

  it('handles empty input safely', () => {
    expect(nameSimilarity('', 'FPT')).toBe(0);
    expect(nameSimilarity('FPT', '')).toBe(0);
    expect(nameSimilarity('', '')).toBe(0);
  });

  it('single-char tokens excluded (length filter)', () => {
    // 'A' filtered out → empty token set → 0
    expect(nameSimilarity('A', 'A')).toBe(0);
  });
});

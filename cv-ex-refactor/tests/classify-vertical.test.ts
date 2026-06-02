// Unit tests for classifyVertical — 10 representative rows per Vertical.
// Pure function, no IO.

import { describe, it, expect } from 'vitest';
import { classifyVertical } from '@/lib/jobs/classify';

describe('classifyVertical', () => {
  // tech vertical
  it('Frontend Developer → tech', () => {
    expect(classifyVertical('Frontend Developer', 'Startup Co')).toBe('tech');
  });
  it('Senior Backend Engineer → tech', () => {
    expect(classifyVertical('Senior Backend Engineer', 'SomeCompany')).toBe('tech');
  });
  it('Data Scientist → tech', () => {
    expect(classifyVertical('Data Scientist', 'Analytics Ltd')).toBe('tech');
  });
  it('DevOps SRE → tech', () => {
    expect(classifyVertical('DevOps SRE', 'Cloud Corp')).toBe('tech');
  });
  it('Mobile iOS Developer → tech', () => {
    expect(classifyVertical('Mobile iOS Developer', 'App Studio')).toBe('tech');
  });

  // marketing vertical
  it('Marketing Manager → marketing', () => {
    expect(classifyVertical('Marketing Manager', 'Brand Co')).toBe('marketing');
  });
  it('SEO Specialist → marketing', () => {
    expect(classifyVertical('SEO Specialist', 'Digital Agency')).toBe('marketing');
  });
  it('Content Creator → marketing', () => {
    expect(classifyVertical('Content Creator', 'Media House')).toBe('marketing');
  });

  // sales vertical
  it('Sales Executive → sales', () => {
    expect(classifyVertical('Sales Executive', 'Retail Co')).toBe('sales');
  });
  it('Key Account Manager → sales', () => {
    expect(classifyVertical('Key Account Manager', 'B2B Corp')).toBe('sales');
  });
  it('Business Development Manager → sales', () => {
    expect(classifyVertical('Business Development Manager', 'Growth Inc')).toBe('sales');
  });

  // ops vertical
  it('Operations Coordinator → ops', () => {
    expect(classifyVertical('Operations Coordinator', 'Logistics Ltd')).toBe('ops');
  });
  it('Supply Chain Specialist → ops', () => {
    expect(classifyVertical('Supply Chain Specialist', 'Warehouse Co')).toBe('ops');
  });

  // finance vertical — company allowlist wins
  it('Software Engineer at Techcombank → finance (company allowlist)', () => {
    expect(classifyVertical('Software Engineer', 'Techcombank')).toBe('finance');
  });
  it('Marketing at VPBank → finance (company allowlist overrides title)', () => {
    expect(classifyVertical('Marketing Specialist', 'VPBank')).toBe('finance');
  });

  // other vertical
  it('HR Business Partner → other', () => {
    expect(classifyVertical('HR Business Partner', 'Generic Corp')).toBe('other');
  });
  it('Product Manager at unknown company → other (no matching pattern)', () => {
    // "Product Manager" does not match sales/ops/marketing/tech regexes
    expect(classifyVertical('Product Manager', 'Generic Corp')).toBe('other');
  });

  // edge cases
  it('empty title and company → other', () => {
    expect(classifyVertical('', '')).toBe('other');
  });
  it('case-insensitive: FRONTEND DEVELOPER → tech', () => {
    expect(classifyVertical('FRONTEND DEVELOPER', 'SomeCo')).toBe('tech');
  });
  it('case-insensitive finance company: vietcombank → finance', () => {
    expect(classifyVertical('Analyst', 'vietcombank')).toBe('finance');
  });
});

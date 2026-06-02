// Heuristic classifier for job vertical and seniority.
// Pure function — no IO. Used at ingest time to auto-tag jobs.
// LLM is NOT invoked here (cost + free-tier conservation).

import type { Seniority, Vertical } from './types';

// Companies whose primary industry is finance/banking/securities.
// Classifier checks company name substring match (case-insensitive).
const FINANCE_COMPANIES = [
  'Vingroup',
  'Techcombank',
  'BIDV',
  'VPBank',
  'Vietcombank',
  'ACB',
  'MB Bank',
  'MBBank',
  'VNDirect',
  'SSI',
  'Sacombank',
  'HDBank',
  'TPBank',
  'VIB',
  'OCB',
  'SHB',
  'LPBank',
  'Agribank',
  'VietinBank',
  'Bảo Việt',
  'Bao Viet',
  'Manulife',
  'Prudential',
  'AIA Vietnam',
  'FWD',
];

function matchesFinanceCompany(company: string): boolean {
  const lower = company.toLowerCase();
  return FINANCE_COMPANIES.some((name) => lower.includes(name.toLowerCase()));
}

/**
 * Classify job vertical from title and company name.
 * Priority: finance company allowlist → title regex cascade.
 */
export function classifyVertical(title: string, company: string): Vertical {
  if (matchesFinanceCompany(company)) return 'finance';

  if (/marketing|brand|content|seo|growth|campaign|digital media/i.test(title)) {
    return 'marketing';
  }
  if (/\bsales\b|account exec|business dev|bd\b|account manager|key account/i.test(title)) {
    return 'sales';
  }
  if (/operation|coordinator|admin|supply chain|logistic|warehouse|procurement/i.test(title)) {
    return 'ops';
  }
  if (/developer|engineer|dev\b|tech|data |qa\b|qc\b|devops|sre|architect|programmer|software|backend|frontend|fullstack|full.stack|mobile|ios|android|machine learning|ml\b|ai\b|nlp/i.test(title)) {
    return 'tech';
  }

  return 'other';
}

/**
 * Classify seniority from job title using regex patterns.
 * Mix of English and Vietnamese patterns — VN job boards (vl24h, topcv) post in Vietnamese.
 * Defaults to 'mid' when no pattern matches.
 */
export function classifySeniority(title: string): Seniority {
  if (/intern|internship|thực tập/i.test(title)) return 'intern';
  if (
    /\blead\b|principal|staff engineer|head of|chapter lead|trưởng phòng|trưởng nhóm|trưởng ban|trưởng bộ phận|giám đốc|phó giám đốc/i.test(
      title,
    )
  ) {
    return 'lead';
  }
  if (/senior|\bsr\b|sr\.|cao cấp/i.test(title)) return 'senior';
  if (/junior|\bjr\b|jr\.|fresher|entry.level|mới ra trường/i.test(title)) return 'junior';
  if (/\bmid\b|middle/i.test(title)) return 'mid';
  return 'mid';
}

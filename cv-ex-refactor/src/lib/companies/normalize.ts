// Company name + location normalization for alias resolution and dedup.
//
// Two-stage normalization mirrors the spec in
// `job_intelligence_local_spec.html` §7 (3-level dedup ladder):
//   1. normalizeCompanyName: strip VN+EN legal-suffix noise, lowercase,
//      preserve diacritics + digits + brand modifiers (Software/Group/
//      Holdings stay distinguishable). Output is the alias-index key.
//   2. companyNameToSlug: ASCII-fold for URL use; ≤60 chars, kebab-case.
//
// Keep both pure — no KV / LLM dependencies. Hot path called once per
// ingest + once per resolveCompany.

const LEGAL_SUFFIX_PATTERN = new RegExp(
  [
    // Vietnamese forms (most common to least)
    'công ty cổ phần',
    'cong ty co phan',
    'công ty tnhh mtv',
    'công ty tnhh',
    'cong ty tnhh',
    'công ty',
    'cong ty',
    'cty\\.?',
    'cổ phần',
    'co phan',
    'tnhh\\s*mtv',
    'tnhh',
    'cp\\b',
    // English / international forms
    'co\\.?,?\\s*ltd\\.?',
    'co\\.?\\s*ltd',
    'jsc\\.?',
    'j\\.s\\.c\\.?',
    'pte\\.?\\s*ltd\\.?',
    'pvt\\.?\\s*ltd\\.?',
    'limited',
    'ltd\\.?',
    'incorporated',
    'inc\\.?',
    'corporation',
    'corp\\.?',
    'llc',
    'gmbh',
    // Holdings + Group intentionally NOT stripped — they distinguish entities
    // in VN market (FPT Group vs FPT Software vs FPT Telecom are separate
    // KV records). Lift only if false-merge regression observed at scale.
  ].join('|'),
  'giu',
);

export function normalizeCompanyName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(LEGAL_SUFFIX_PATTERN, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip diacritics + convert to kebab-case slug ≤ 60 chars. Stable URL identifier.
 * Always called on the original raw name (not the normalized form) so distinguishing
 * tokens (Software, Group, Holdings) survive.
 */
export function companyNameToSlug(rawName: string): string {
  const ascii = rawName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return ascii.slice(0, 60);
}

/**
 * Vietnam city/location normalization — used by Phase 02 ingest dedup
 * (company+title+location triple key). Maps common variants of HCMC,
 * Hanoi, Da Nang to canonical forms.
 */
const LOCATION_ALIASES: Record<string, string> = {
  'ho chi minh': 'ho chi minh city',
  'ho chi minh city': 'ho chi minh city',
  'hochiminh': 'ho chi minh city',
  'hcmc': 'ho chi minh city',
  'hcm': 'ho chi minh city',
  'saigon': 'ho chi minh city',
  'sai gon': 'ho chi minh city',
  'tphcm': 'ho chi minh city',
  'tp hcm': 'ho chi minh city',
  'thanh pho ho chi minh': 'ho chi minh city',
  'ha noi': 'hanoi',
  'hanoi': 'hanoi',
  'ha-noi': 'hanoi',
  'da nang': 'da nang',
  'danang': 'da nang',
  'đà nẵng': 'da nang',
};

export function normalizeLocation(raw: string): string {
  const ascii = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (LOCATION_ALIASES[ascii]) return LOCATION_ALIASES[ascii];

  for (const [alias, canonical] of Object.entries(LOCATION_ALIASES)) {
    if (ascii.includes(alias)) return canonical;
  }
  return ascii;
}

/**
 * Map source-site company-size phrasing to the 5-bucket enum. Returns
 * undefined if the raw text doesn't match any pattern (caller decides
 * whether to leave the size field empty or mark scrape as partial).
 *
 * Covered shapes from observed VN job boards:
 *   "1000+", "1000+ employees", "1000+ nhân viên"
 *   "100-499 nhân viên", "501 - 1000 employees"
 *   "10-24", "25-99", "100-499", "500-999", "1000+"   (ITviec ranges)
 *   "Less than 10", "Under 10", "Dưới 10"             (TopCV)
 *   "10000+", "10,000+"                                (large multinationals)
 */
export function parseSizeRange(raw: string): '1-50' | '51-200' | '201-1000' | '1001-5000' | '5000+' | undefined {
  if (!raw) return undefined;
  const text = raw.toLowerCase().replace(/[,.]/g, '').replace(/\s+/g, ' ').trim();

  if (/^(under|less than|dưới|duoi)\s*\d+/.test(text)) return '1-50';

  const plusMatch = text.match(/(\d+)\s*\+/);
  if (plusMatch?.[1]) {
    const n = Number.parseInt(plusMatch[1], 10);
    return bucketFor(n);
  }

  const rangeMatch = text.match(/(\d+)\s*[-–—to]+\s*(\d+)/);
  if (rangeMatch?.[1] && rangeMatch[2]) {
    const lo = Number.parseInt(rangeMatch[1], 10);
    const hi = Number.parseInt(rangeMatch[2], 10);
    return bucketFor(Math.round((lo + hi) / 2));
  }

  const singleMatch = text.match(/\b(\d+)\b/);
  if (singleMatch?.[1]) {
    const n = Number.parseInt(singleMatch[1], 10);
    return bucketFor(n);
  }

  return undefined;
}

function bucketFor(n: number): '1-50' | '51-200' | '201-1000' | '1001-5000' | '5000+' {
  if (n <= 50) return '1-50';
  if (n <= 200) return '51-200';
  if (n <= 1000) return '201-1000';
  if (n <= 5000) return '1001-5000';
  return '5000+';
}

/**
 * Lightweight similarity ratio for early dedup gate (avoids LLM call when names
 * are clearly identical or clearly different). Jaccard over normalized tokens.
 * Range 0-1. Use threshold 0.5 to call LLM ranker; below → mint-new without LLM.
 */
export function nameSimilarity(a: string, b: string): number {
  const tokens = (s: string): Set<string> =>
    new Set(normalizeCompanyName(s).split(' ').filter((t) => t.length >= 2));

  const aTokens = tokens(a);
  const bTokens = tokens(b);
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersect = 0;
  for (const t of aTokens) if (bTokens.has(t)) intersect += 1;

  return intersect / (aTokens.size + bTokens.size - intersect);
}

// Heuristic classifier for CV body → Vertical. Used as a pre-filter on the
// Job Fit pipeline so the LLM only ranks candidates from the same vertical
// (denser semantic match, fewer false positives). Pure function — no IO,
// no LLM cost. Counts weighted keyword hits in the first ~3000 chars of CV
// (objective/headline section) and returns the highest-scoring vertical.

import type { Vertical } from './types';

interface VerticalSignal {
  vertical: Vertical;
  patterns: RegExp[];
  weight: number;
}

// Vietnamese + English keywords per vertical. Patterns use word boundaries
// where possible to avoid sub-string false matches.
const SIGNALS: VerticalSignal[] = [
  {
    vertical: 'tech',
    patterns: [
      /\b(software|backend|frontend|fullstack|full.stack|devops|sre|engineer|developer|programmer)\b/i,
      /\b(javascript|typescript|python|java|golang|kotlin|swift|react|vue|angular|node\.?js|nest\.?js|next\.?js)\b/i,
      /\b(kubernetes|docker|aws|gcp|azure|terraform|kafka|postgres|mysql|mongodb|redis)\b/i,
      /\b(machine learning|deep learning|nlp|computer vision|data scientist|data engineer|ml engineer|ai engineer)\b/i,
      /\b(mobile|ios|android|flutter|react native)\b/i,
      /lập trình viên|kỹ sư phần mềm|kỹ sư.*\b(it|công nghệ)\b/i,
    ],
    weight: 1,
  },
  {
    vertical: 'finance',
    patterns: [
      /\b(accountant|accounting|auditor|finance|banking|treasury|tax|controller|cfo)\b/i,
      /kế toán|kiểm toán|tài chính|ngân hàng|thuế|kế toán trưởng/i,
      /\b(cpa|acca|cfa|chứng chỉ kế toán)\b/i,
    ],
    weight: 1,
  },
  {
    vertical: 'marketing',
    patterns: [
      /\b(marketing|brand|content|seo|sem|growth|campaign|digital marketing|copywriter|copywriting)\b/i,
      /\b(facebook ads|google ads|tiktok ads|adwords|social media)\b/i,
      /quảng cáo|truyền thông|thương hiệu|nội dung số|tiếp thị/i,
    ],
    weight: 1,
  },
  {
    vertical: 'sales',
    patterns: [
      /\b(sales|account exec|account manager|business development|bd\b|key account|inside sales)\b/i,
      /\b(retail|wholesale|distribution|merchandiser)\b/i,
      /kinh doanh|bán hàng|chăm sóc khách hàng b2b|phát triển thị trường|bất động sản/i,
    ],
    weight: 1,
  },
  {
    vertical: 'ops',
    patterns: [
      /\b(operations|coordinator|supply chain|logistic|procurement|warehouse|inventory)\b/i,
      /\b(hr|human resources|talent|recruitment|recruiter|payroll)\b/i,
      /\b(admin|administrative|secretary|office manager)\b/i,
      /vận hành|hành chính|thư ký|nhân sự|cung ứng|chuỗi cung ứng|xuất nhập khẩu|kho vận/i,
    ],
    weight: 1,
  },
];

/**
 * Returns the dominant Vertical inferred from the CV body, or `null` when no
 * vertical scores higher than zero (caller falls back to no filter — full pool).
 * Looks at the first 3000 chars; resumes typically have role/headline up top.
 */
export function classifyCvVertical(cvText: string): Vertical | null {
  const head = cvText.slice(0, 3000);
  const scores: Partial<Record<Vertical, number>> = {};
  for (const sig of SIGNALS) {
    let hits = 0;
    for (const pat of sig.patterns) {
      const matches = head.match(new RegExp(pat.source, pat.flags.includes('g') ? pat.flags : pat.flags + 'g'));
      if (matches) hits += matches.length;
    }
    if (hits > 0) scores[sig.vertical] = (scores[sig.vertical] ?? 0) + hits * sig.weight;
  }

  let best: Vertical | null = null;
  let bestScore = 0;
  for (const [v, s] of Object.entries(scores) as Array<[Vertical, number]>) {
    if (s > bestScore) {
      best = v;
      bestScore = s;
    }
  }
  return best;
}

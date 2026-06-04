// Unit tests for role-infer module — pure parse + threshold logic.
// Live LLM accuracy benchmark (≥85% top-1 at conf >=0.75 over 20 fixtures)
// is run manually via scripts/smoke-role-infer.ts before each ship — not
// CI-asserted here because real Gemini calls bleed quota.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  RoleInferResultSchema,
  parseRoleInferResponse,
  isHighConfidence,
  buildCandidates,
  getConfidenceThreshold,
} from '@/lib/llm/role-infer';
import { buildRoleInferPrompts } from '@/lib/llm/role-infer-prompt';

const SAMPLE_CV = `Senior Backend Engineer @ FinCorp (3y).
Stack: Node.js, TypeScript, Postgres, Kafka, Kubernetes.
Owned payments service handling 2M req/day.
Led 4-person team. Previously: Mid Backend @ TechStartup (2y).`;

describe('RoleInferResultSchema', () => {
  it('accepts well-formed shape with alternates', () => {
    const ok = RoleInferResultSchema.safeParse({
      canonical: 'Senior Backend Engineer',
      confidence: 0.88,
      alternates: ['Backend Tech Lead', 'Platform Engineer'],
    });
    expect(ok.success).toBe(true);
  });

  it('defaults alternates to [] when omitted', () => {
    const parsed = RoleInferResultSchema.safeParse({
      canonical: 'Designer',
      confidence: 0.7,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.alternates).toEqual([]);
  });

  it.each([
    ['confidence > 1', { canonical: 'X', confidence: 1.4, alternates: [] }],
    ['confidence < 0', { canonical: 'X', confidence: -0.1, alternates: [] }],
    ['canonical too short', { canonical: 'A', confidence: 0.7, alternates: [] }],
    ['alternates too long', { canonical: 'X', confidence: 0.7, alternates: ['a', 'b', 'c', 'd'] }],
  ])('rejects %s', (_, payload) => {
    expect(RoleInferResultSchema.safeParse(payload).success).toBe(false);
  });
});

describe('parseRoleInferResponse', () => {
  it('parses plain JSON', () => {
    const raw = '{"canonical":"Marketing Manager","confidence":0.81,"alternates":["Brand Manager"]}';
    const out = parseRoleInferResponse(raw);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.canonical).toBe('Marketing Manager');
      expect(out.result.confidence).toBe(0.81);
    }
  });

  it('parses JSON wrapped in ```json fences', () => {
    const raw = '```json\n{"canonical":"PM","confidence":0.65,"alternates":[]}\n```';
    const out = parseRoleInferResponse(raw);
    expect(out.ok).toBe(true);
  });

  it('returns parse_failed for empty output', () => {
    const out = parseRoleInferResponse('   ');
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe('role_infer_parse_failed');
  });

  it('returns parse_failed for non-JSON gibberish', () => {
    const out = parseRoleInferResponse('the candidate looks like a developer');
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe('role_infer_parse_failed');
  });

  it('returns invalid_shape when JSON parses but fails Zod', () => {
    const raw = '{"canonical":"X","confidence":2.0,"alternates":[]}';
    const out = parseRoleInferResponse(raw);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe('role_infer_invalid_shape');
  });

  it('surfaces actionable VN message on failure (no silent fallback)', () => {
    const out = parseRoleInferResponse('not json');
    if (!out.ok) {
      expect(out.message.length).toBeGreaterThan(10);
      expect(out.status).toBe(502);
    }
  });
});

describe('isHighConfidence', () => {
  it('passes at exact threshold (default 0.75)', () => {
    expect(isHighConfidence({ canonical: 'X', confidence: 0.75, alternates: [] })).toBe(true);
  });
  it('fails just below threshold', () => {
    expect(isHighConfidence({ canonical: 'X', confidence: 0.749, alternates: [] })).toBe(false);
  });
  it('respects override threshold arg', () => {
    expect(isHighConfidence({ canonical: 'X', confidence: 0.6, alternates: [] }, 0.5)).toBe(true);
  });
});

describe('getConfidenceThreshold', () => {
  const original = process.env.ROLE_INFER_CONFIDENCE_THRESHOLD;
  beforeEach(() => { delete process.env.ROLE_INFER_CONFIDENCE_THRESHOLD; });
  afterEach(() => {
    if (original === undefined) delete process.env.ROLE_INFER_CONFIDENCE_THRESHOLD;
    else process.env.ROLE_INFER_CONFIDENCE_THRESHOLD = original;
  });

  it('defaults to 0.75 when env unset', () => {
    expect(getConfidenceThreshold()).toBe(0.75);
  });
  it('reads valid env override', () => {
    process.env.ROLE_INFER_CONFIDENCE_THRESHOLD = '0.6';
    expect(getConfidenceThreshold()).toBe(0.6);
  });
  it('falls back to default for invalid env value', () => {
    process.env.ROLE_INFER_CONFIDENCE_THRESHOLD = 'not-a-number';
    expect(getConfidenceThreshold()).toBe(0.75);
  });
  it('rejects out-of-range env values', () => {
    process.env.ROLE_INFER_CONFIDENCE_THRESHOLD = '1.5';
    expect(getConfidenceThreshold()).toBe(0.75);
  });
});

describe('buildCandidates', () => {
  it('prepends canonical + decays alternate confidence by 0.1 each', () => {
    const list = buildCandidates({
      canonical: 'Frontend Engineer',
      confidence: 0.6,
      alternates: ['Full-Stack', 'Designer'],
    });
    expect(list).toEqual([
      { canonical: 'Frontend Engineer', confidence: 0.6 },
      { canonical: 'Full-Stack', confidence: 0.5 },
      { canonical: 'Designer', confidence: 0.4 },
    ]);
  });
  it('clamps decayed confidence at 0', () => {
    const list = buildCandidates({
      canonical: 'X',
      confidence: 0.05,
      alternates: ['A', 'B', 'C'],
    });
    expect(list[3]?.confidence).toBe(0);
  });
  it('returns just the canonical when no alternates', () => {
    const list = buildCandidates({ canonical: 'PM', confidence: 0.9, alternates: [] });
    expect(list).toHaveLength(1);
  });
});

describe('buildRoleInferPrompts', () => {
  it('returns system + user strings, includes CV', () => {
    const { system, user } = buildRoleInferPrompts({ cvText: SAMPLE_CV });
    expect(system.length).toBeGreaterThan(50);
    expect(user).toContain(SAMPLE_CV);
  });
  it('includes few-shot examples (A, B, C)', () => {
    const { user } = buildRoleInferPrompts({ cvText: SAMPLE_CV });
    expect(user).toContain('Example A');
    expect(user).toContain('Example B');
    expect(user).toContain('Example C');
  });
  it('includes confidence rubric thresholds', () => {
    const { user } = buildRoleInferPrompts({ cvText: SAMPLE_CV });
    expect(user).toContain('0.85-1.00');
    expect(user).toContain('0.65-0.84');
    expect(user).toMatch(/canonical/);
    expect(user).toMatch(/confidence/);
    expect(user).toMatch(/alternates/);
  });
});

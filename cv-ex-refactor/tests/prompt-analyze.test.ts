// Smoke tests for buildAnalyzePrompts (v2 CV-vs-JD). Verifies Phase 1b
// polish: strictness as score-delta (with 'friendly' removed), distinct
// coverage-vs-must-haves rule, JD industry step-0 instruction,
// roleAlignment field in schema, VN register block conditional on
// language.

import { describe, it, expect } from 'vitest';
import { buildAnalyzePrompts } from '@/lib/llm/prompt-analyze';
import type { AnalyzeBodyT } from '@/lib/schemas/llm-request';

const BASE: AnalyzeBodyT = {
  llm: { provider: 'gemini', model: 'gemini-flash-latest', temperature: 0.3 },
  inputs: {
    jdText: 'Senior Backend Engineer. 5+ yrs Python/Go, distributed systems on GCP. Lead a team of 4. Fintech.',
    cvText: 'Nguyen A — Backend Engineer. Node, Postgres, K8s. 4 yrs at FinCorp.',
    targetRole: 'software',
    strictness: 'balanced',
    language: 'auto',
    mustHaves: ['5+ years Python/Go', 'GCP production experience', 'Team leadership'],
  },
};

describe('buildAnalyzePrompts (v2 — JD anchored)', () => {
  it('returns system + user of meaningful length', () => {
    const { system, user } = buildAnalyzePrompts(BASE);
    expect(system.length).toBeGreaterThan(50);
    expect(user.length).toBeGreaterThan(500);
  });

  it('renders JD + CV + must-haves sections', () => {
    const { user } = buildAnalyzePrompts(BASE);
    expect(user).toContain('=== JOB DESCRIPTION ===');
    expect(user).toContain('Senior Backend Engineer');
    expect(user).toContain('Nguyen A');
    expect(user).toContain('=== MUST-HAVE HARD GATE');
    expect(user).toContain('5+ years Python/Go');
  });

  it('emits Step 0 JD-industry tagging instruction', () => {
    const { user } = buildAnalyzePrompts(BASE);
    expect(user).toMatch(/STEP 0.*IDENTIFY JD INDUSTRY/);
    expect(user).toMatch(/fintech/);
    expect(user).toMatch(/mention the inferred industry in/);
  });

  it('emits roleAlignment field in schema', () => {
    const { user } = buildAnalyzePrompts(BASE);
    expect(user).toMatch(/"roleAlignment"/);
    expect(user).toMatch(/"aligned"/);
    expect(user).toMatch(/Compute `roleAlignment`/);
  });

  it('strictness=strict applies score-delta instruction', () => {
    const { user } = buildAnalyzePrompts({
      ...BASE,
      inputs: { ...BASE.inputs, strictness: 'strict' },
    });
    expect(user).toMatch(/Strictness: strict/);
    expect(user).toMatch(/subtract ~10 points/);
  });

  it('strictness=balanced reports intuition as-is', () => {
    const { user } = buildAnalyzePrompts(BASE);
    expect(user).toMatch(/Strictness: balanced/);
    expect(user).toMatch(/honest intuition/);
  });

  it('rule #8 enforces coverage distinct from must-haves', () => {
    const { user } = buildAnalyzePrompts(BASE);
    expect(user).toMatch(/DO NOT duplicate them as coverage/);
    expect(user).toMatch(/JD signals BEYOND must-haves/);
  });

  it('locks Vietnamese register when language is vi', () => {
    const { user } = buildAnalyzePrompts({
      ...BASE,
      inputs: { ...BASE.inputs, language: 'vi' },
    });
    expect(user).toMatch(/recruiter-Vietnamese register/);
    expect(user).toMatch(/xây dựng/);
  });

  it('does NOT inject Vietnamese register when language is en', () => {
    const { user } = buildAnalyzePrompts({
      ...BASE,
      inputs: { ...BASE.inputs, language: 'en' },
    });
    expect(user).not.toMatch(/recruiter-Vietnamese register/);
  });

  it('does NOT output overallScore (client-computed)', () => {
    const { user } = buildAnalyzePrompts(BASE);
    expect(user).toMatch(/Do NOT output overall score/);
  });

  it('renders 9-dim rubric labels', () => {
    const { user } = buildAnalyzePrompts(BASE);
    for (const dim of [
      'coreSkill', 'tool', 'scope', 'production', 'domain',
      'evidence', 'seniority', 'impact', 'communication',
    ]) {
      expect(user).toContain(dim);
    }
  });
});

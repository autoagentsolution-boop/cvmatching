// Smoke tests for v0.4 CV-Solo refine prompt builder. Pure function — no
// LLM calls. Confirms the prompt carries findings and dispatches to the
// right STYLE/MODE instructions per tone/length.

import { describe, it, expect } from 'vitest';
import { buildGenerateCvV3Prompts } from '@/lib/llm/prompt-generate-cv-v3';
import type { GenerateCvV3BodyT } from '@/lib/schemas/llm-request';

const BASE: GenerateCvV3BodyT = {
  llm: { provider: 'gemini', model: 'gemini-2.5-flash', temperature: 0.3 },
  inputs: {
    cvText: 'Nguyen A — Backend Engineer. Node, Postgres, K8s. 4 yrs at FinCorp.',
    language: 'auto',
    tone: 'impact',
    length: 'medium',
  },
  findings: {
    role: 'Senior Backend Engineer',
    strengths: ['Strong Node.js depth — owned payments service'],
    wordingGaps: ['Lead/IC ownership unclear — surface team size'],
    recommendations: ['Add quantified outcome to payments bullet'],
    suggestedSummaryLine: 'Senior backend engineer with 4 yrs scaling payment systems at FinCorp.',
    weakDimensions: ['communication'],
  },
};

describe('buildGenerateCvV3Prompts', () => {
  it('returns system + user strings of meaningful length', () => {
    const { system, user } = buildGenerateCvV3Prompts(BASE);
    expect(system.length).toBeGreaterThan(50);
    expect(user.length).toBeGreaterThan(500);
  });

  it('renders role + cv + findings sections', () => {
    const { user } = buildGenerateCvV3Prompts(BASE);
    expect(user).toContain('Senior Backend Engineer');
    expect(user).toContain('Nguyen A');
    expect(user).toContain('Strong Node.js depth');
    expect(user).toContain('Lead/IC ownership unclear');
    expect(user).toContain('Add quantified outcome');
    expect(user).toContain('Senior backend engineer with 4 yrs');
    expect(user).toContain('communication');
  });

  it('asserts CV-solo positioning (no JD anywhere)', () => {
    const { user } = buildGenerateCvV3Prompts(BASE);
    expect(user).not.toMatch(/=== JOB DESCRIPTION ===/);
    expect(user).toMatch(/There is no Job Description/);
  });

  it('includes today date for date-reasoning', () => {
    const { user } = buildGenerateCvV3Prompts(BASE);
    expect(user).toMatch(/TODAY'S DATE/);
    expect(user).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('keeps REFINE-NOTES separator contract identical to v2', () => {
    const { user } = buildGenerateCvV3Prompts(BASE);
    expect(user).toContain('<!--REFINE-NOTES-->');
    expect(user).toMatch(/Block 1 — THE CV/);
    expect(user).toMatch(/Block 2 — REFINE NOTES/);
  });

  it('forbids invention in HARD RULES + asserts truthful rephrase guidance', () => {
    const { user } = buildGenerateCvV3Prompts(BASE);
    expect(user).toMatch(/DO NOT invent/i);
    expect(user).toMatch(/rephrase existing bullets/i);
  });

  it('renders empty bullet placeholder when findings list is empty', () => {
    const { user } = buildGenerateCvV3Prompts({
      ...BASE,
      findings: {
        role: 'Role',
        strengths: [],
        wordingGaps: [],
        recommendations: [],
        weakDimensions: [],
      },
    });
    expect(user).toMatch(/Strengths to amplify[\s\S]*\(none\)/);
    expect(user).toMatch(/Wording gaps to fix[\s\S]*\(none\)/);
  });

  it('language switch: vi → instructs Vietnamese', () => {
    const { user } = buildGenerateCvV3Prompts({
      ...BASE,
      inputs: { ...BASE.inputs, language: 'vi' },
    });
    expect(user).toMatch(/Write the CV in Vietnamese/);
  });
});

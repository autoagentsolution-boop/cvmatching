import { describe, it, expect } from 'vitest';
import { buildCareerPathPrompts } from '@/lib/llm/prompt-career-path';
import type { CareerPathBodyT } from '@/lib/schemas/llm-request';

const CV = 'Senior Backend Engineer. 5 yrs Node/Python on AWS at FinCorp. Led payments service.';

const BASE: CareerPathBodyT = {
  llm: { provider: 'gemini', model: 'gemini-flash-latest', temperature: 0.3 },
  inputs: {
    cvText: CV,
    aspiration: {
      targetRole: 'Staff Engineer',
      horizonYears: 3,
      focusAreas: ['depth'],
    },
    language: 'auto',
  },
};

describe('buildCareerPathPrompts', () => {
  it('returns system + user of meaningful length', () => {
    const { system, user } = buildCareerPathPrompts(BASE);
    expect(system.length).toBeGreaterThan(500);
    expect(user.length).toBeGreaterThan(500);
  });

  it('embeds the few-shot Staff-Engineer style example in system prompt', () => {
    const { system } = buildCareerPathPrompts(BASE);
    expect(system).toMatch(/STYLE EXAMPLE/);
    expect(system).toMatch(/Staff Engineer/);
    expect(system).toMatch(/DO NOT copy verbatim/);
  });

  it('emits specificity rubric for skillGap.howToLearn (course + project + timeline)', () => {
    const { user } = buildCareerPathPrompts(BASE);
    expect(user).toMatch(/SPECIFICITY RUBRIC/);
    expect(user).toMatch(/course OR book OR mentor/);
    expect(user).toMatch(/project OR repo OR shippable artifact/);
    expect(user).toMatch(/timeline.*weeks.*months/i);
  });

  it('schema declares ambitionGap + requiredSteps under feasibility', () => {
    const { user } = buildCareerPathPrompts(BASE);
    expect(user).toMatch(/"ambitionGap"/);
    expect(user).toMatch(/"requiredSteps"/);
  });

  it('schema declares quickWins object shape {action, effortHours, outcome}', () => {
    const { user } = buildCareerPathPrompts(BASE);
    expect(user).toMatch(/"action".*verb-led/);
    expect(user).toMatch(/"effortHours"/);
    expect(user).toMatch(/"outcome"/);
  });

  it('enforces alternativePaths ≥1 rule', () => {
    const { user } = buildCareerPathPrompts(BASE);
    expect(user).toMatch(/alternativePaths MUST contain ≥1 entry/);
  });

  it('drops gentleAdvice softness — no "patronizing softener" language allowed', () => {
    const { user } = buildCareerPathPrompts(BASE);
    expect(user).toMatch(/no patronizing softener/);
    expect(user).toMatch(/no praise for ambition/);
  });

  describe('industry anchor', () => {
    it('emits INDUSTRY ANCHOR block when inputs.industry non-empty', () => {
      const { user } = buildCareerPathPrompts({
        ...BASE,
        inputs: { ...BASE.inputs, industry: 'fintech' },
      });
      expect(user).toMatch(/=== INDUSTRY ANCHOR ===/);
      expect(user).toContain('fintech');
      expect(user).toMatch(/industry-specific/);
    });

    it('omits INDUSTRY ANCHOR block when inputs.industry empty', () => {
      const { user } = buildCareerPathPrompts(BASE);
      expect(user).not.toMatch(/=== INDUSTRY ANCHOR ===/);
    });

    it('treats whitespace-only industry as empty', () => {
      const { user } = buildCareerPathPrompts({
        ...BASE,
        inputs: { ...BASE.inputs, industry: '   ' },
      });
      expect(user).not.toMatch(/=== INDUSTRY ANCHOR ===/);
    });
  });
});

// Unit tests for buildAnalyzeV3Prompts — pure builder, no LLM call.
// Verifies prompt shape, language switching, profile injection, role echo,
// schema + rubric inclusion. Output-quality A/B vs v2 is a manual review
// per phase-01-scoring-prompt-rewrite.md (not asserted here).

import { describe, it, expect } from 'vitest';
import { buildAnalyzeV3Prompts } from '@/lib/llm/prompt-analyze-v3';

const CV_SAMPLE = `Nguyen Van A — Senior Backend Engineer
6 years building distributed systems on AWS. Led 4-person team.
Stack: Node.js, TypeScript, Postgres, Kafka, K8s.
Shipped payments service handling 2M req/day at LazyCorp.`;

const ROLE = 'Senior Backend Engineer';

describe('buildAnalyzeV3Prompts', () => {
  it('returns system + user strings', () => {
    const { system, user } = buildAnalyzeV3Prompts({ cvText: CV_SAMPLE, role: ROLE });
    expect(typeof system).toBe('string');
    expect(typeof user).toBe('string');
    expect(system.length).toBeGreaterThan(50);
    expect(user.length).toBeGreaterThan(200);
  });

  it('echoes the claimed role into the user prompt', () => {
    const { user } = buildAnalyzeV3Prompts({ cvText: CV_SAMPLE, role: ROLE });
    expect(user).toContain(ROLE);
    expect(user).toContain("CANDIDATE'S CLAIMED ROLE");
  });

  it('includes the CV text in the user prompt', () => {
    const { user } = buildAnalyzeV3Prompts({ cvText: CV_SAMPLE, role: ROLE });
    expect(user).toContain('Nguyen Van A');
    expect(user).toContain('payments service handling 2M req/day');
  });

  it('drops JD-related framing from system + user (v3 contract)', () => {
    const { system, user } = buildAnalyzeV3Prompts({ cvText: CV_SAMPLE, role: ROLE });
    const combined = `${system}\n${user}`;
    expect(combined).not.toMatch(/JOB DESCRIPTION/);
    expect(combined).not.toMatch(/MUST-HAVE HARD GATE/);
    // Schema must not advertise coverage[] (dropped in v3)
    expect(combined).not.toMatch(/"coverage":\s*\[/);
    // Should explicitly tell the LLM coverage is dropped
    expect(user).toMatch(/coverage.*dropped/i);
  });

  it('includes the 9-dimension rubric labels', () => {
    const { user } = buildAnalyzeV3Prompts({ cvText: CV_SAMPLE, role: ROLE });
    for (const dim of [
      'coreSkill', 'tool', 'scope', 'production', 'domain',
      'evidence', 'seniority', 'impact', 'communication',
    ]) {
      expect(user).toContain(dim);
    }
  });

  it('includes the JSON output schema sketch', () => {
    const { user } = buildAnalyzeV3Prompts({ cvText: CV_SAMPLE, role: ROLE });
    expect(user).toMatch(/"detectedRole"/);
    expect(user).toMatch(/"metrics"/);
    expect(user).toMatch(/"keywordCoverage"/);
    expect(user).toMatch(/"suggestedSummaryLine"/);
  });

  it('forbids overallScore / decision in output (client-computed)', () => {
    const { user } = buildAnalyzeV3Prompts({ cvText: CV_SAMPLE, role: ROLE });
    expect(user).toMatch(/Do NOT output overallScore/i);
  });

  describe('language switching', () => {
    it('vi → instructs Vietnamese output', () => {
      const { user } = buildAnalyzeV3Prompts({ cvText: CV_SAMPLE, role: ROLE, language: 'vi' });
      expect(user).toMatch(/Vietnamese/);
    });
    it('en → instructs English output', () => {
      const { user } = buildAnalyzeV3Prompts({ cvText: CV_SAMPLE, role: ROLE, language: 'en' });
      expect(user).toMatch(/Respond in English/);
    });
    it('auto (default) → instructs CV-language output', () => {
      const { user } = buildAnalyzeV3Prompts({ cvText: CV_SAMPLE, role: ROLE });
      expect(user).toMatch(/Respond in the CV language/);
    });
  });

  describe('profile injection', () => {
    it('includes profile text when provided', () => {
      const profile = 'Also led migration of legacy monolith to microservices for 18 months.';
      const { user } = buildAnalyzeV3Prompts({
        cvText: CV_SAMPLE, role: ROLE, profileText: profile,
      });
      expect(user).toContain(profile);
    });
    it('renders "(none provided)" when profile is absent or blank', () => {
      const { user: noProfile } = buildAnalyzeV3Prompts({ cvText: CV_SAMPLE, role: ROLE });
      const { user: blankProfile } = buildAnalyzeV3Prompts({
        cvText: CV_SAMPLE, role: ROLE, profileText: '   ',
      });
      expect(noProfile).toContain('(none provided)');
      expect(blankProfile).toContain('(none provided)');
    });
  });

  it('asserts CV-intrinsic scoring (not JD-comparison) in system message', () => {
    const { system } = buildAnalyzeV3Prompts({ cvText: CV_SAMPLE, role: ROLE });
    expect(system).toMatch(/intrinsically/i);
    expect(system).toMatch(/not comparing against any specific JD/i);
  });

  describe('todayIso injection (date-hallucination hotfix)', () => {
    it('renders the provided date verbatim under TODAY section', () => {
      const { user } = buildAnalyzeV3Prompts({
        cvText: CV_SAMPLE, role: ROLE, todayIso: '2026-06-04',
      });
      expect(user).toContain("TODAY'S DATE");
      expect(user).toContain('2026-06-04');
      expect(user).toMatch(/may be in the past relative to TODAY/i);
    });
    it('warns the LLM not to assume training-cutoff date when omitted', () => {
      const { user } = buildAnalyzeV3Prompts({ cvText: CV_SAMPLE, role: ROLE });
      expect(user).toMatch(/unknown.*treat all CV dates as historical/i);
    });
  });
});

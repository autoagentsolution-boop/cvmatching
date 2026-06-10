import { describe, it, expect } from 'vitest';
import { buildCoverLetterPrompts } from '@/lib/llm/prompt-generate-cover-letter';
import type { CoverLetterBodyT } from '@/lib/schemas/cover-letter-request';

const EN_JD = 'Senior Backend Engineer. 5+ years Python/Go, distributed systems on GCP. Lead a team of 4.';
const VI_JD = 'Kỹ sư backend cao cấp. 5+ năm kinh nghiệm Python/Go, hệ thống phân tán trên GCP. Dẫn dắt đội 4 người. Yêu cầu giao tiếp tốt và khả năng làm việc nhóm.';
const CV = 'Nguyen A — Backend Engineer. Node, Postgres, K8s. 4 yrs at FinCorp. Built payments service 2M req/day.';

const BASE: CoverLetterBodyT = {
  llm: { provider: 'gemini', model: 'gemini-flash-latest', temperature: 0.3 },
  inputs: {
    cvText: CV,
    jdText: EN_JD,
    jobTitle: 'Senior Backend Engineer',
    company: 'Acme Tech',
    language: 'en',
    tone: 'professional',
    length: 'medium',
  },
};

describe('buildCoverLetterPrompts', () => {
  it('returns system + user of meaningful length', () => {
    const { system, user } = buildCoverLetterPrompts(BASE);
    expect(system.length).toBeGreaterThan(200);
    expect(user.length).toBeGreaterThan(200);
  });

  it('renders sanitized jobTitle + company in heading line', () => {
    const { user } = buildCoverLetterPrompts({
      ...BASE,
      inputs: {
        ...BASE.inputs,
        jobTitle: 'Senior [Backend] Engineer*',
        company: '### Acme `Corp`',
      },
    });
    expect(user).toContain('Cover Letter — Senior Backend Engineer @ Acme Corp');
    expect(user).not.toContain('[Backend]');
    expect(user).not.toContain('###');
    expect(user).not.toContain('`Corp`');
  });

  describe('tone presets', () => {
    it.each(['warm', 'professional', 'concise', 'leadership'] as const)(
      'emits %s tone instruction in user prompt',
      (tone) => {
        const { user } = buildCoverLetterPrompts({
          ...BASE,
          inputs: { ...BASE.inputs, tone },
        });
        // Each tone has a distinctive lead word — assert a discriminator is present.
        const discriminators: Record<typeof tone, RegExp> = {
          warm: /warm, personalized/i,
          professional: /professional, recruiter-grade/i,
          concise: /concise/i,
          leadership: /leadership/i,
        };
        expect(user).toMatch(discriminators[tone]);
      },
    );
  });

  describe('length bands', () => {
    it('short → 150-200 words', () => {
      const { user, system } = buildCoverLetterPrompts({
        ...BASE,
        inputs: { ...BASE.inputs, length: 'short' },
      });
      expect(`${system}\n${user}`).toMatch(/150-200 words total/);
    });
    it('medium → 250-400 words', () => {
      const { user, system } = buildCoverLetterPrompts(BASE);
      expect(`${system}\n${user}`).toMatch(/250-400 words total/);
    });
    it('long → 400-550 words', () => {
      const { user, system } = buildCoverLetterPrompts({
        ...BASE,
        inputs: { ...BASE.inputs, length: 'long' },
      });
      expect(`${system}\n${user}`).toMatch(/400-550 words total/);
    });
  });

  describe('bilingual system prompt', () => {
    it('language=vi → VI system prompt', () => {
      const { system } = buildCoverLetterPrompts({
        ...BASE,
        inputs: { ...BASE.inputs, language: 'vi', jdText: VI_JD },
      });
      expect(system).toMatch(/chuyên gia viết cover letter/);
      expect(system).toMatch(/Bằng chứng/);
    });
    it('language=en → EN system prompt', () => {
      const { system } = buildCoverLetterPrompts(BASE);
      expect(system).toMatch(/cover-letter specialist/);
      expect(system).toMatch(/Evidence/);
    });
    it('language=auto → VI when JD has Vietnamese diacritic density >2%', () => {
      const { system } = buildCoverLetterPrompts({
        ...BASE,
        inputs: { ...BASE.inputs, language: 'auto', jdText: VI_JD },
      });
      expect(system).toMatch(/chuyên gia viết cover letter/);
    });
    it('language=auto → EN when JD has no Vietnamese diacritics', () => {
      const { system } = buildCoverLetterPrompts({
        ...BASE,
        inputs: { ...BASE.inputs, language: 'auto' },
      });
      expect(system).toMatch(/cover-letter specialist/);
    });
  });

  describe('analysis findings feed', () => {
    it('emits strengthsToLead block when present', () => {
      const { user } = buildCoverLetterPrompts({
        ...BASE,
        inputs: {
          ...BASE.inputs,
          strengthsToLead: ['Owned payments service 2M req/day', 'Led team of 4 through 3 launches'],
        },
      });
      expect(user).toMatch(/=== STRENGTHS TO LEAD ===/);
      expect(user).toContain('Owned payments service 2M req/day');
      expect(user).toMatch(/Evidence paragraph MUST lead/);
    });

    it('omits strengths block when array absent or empty', () => {
      const { user } = buildCoverLetterPrompts(BASE);
      expect(user).not.toMatch(/=== STRENGTHS TO LEAD ===/);
    });

    it('emits gapToAddress block when present', () => {
      const { user } = buildCoverLetterPrompts({
        ...BASE,
        inputs: { ...BASE.inputs, gapToAddress: 'No direct Kubernetes production experience' },
      });
      expect(user).toMatch(/=== GAP TO ADDRESS ===/);
      expect(user).toContain('No direct Kubernetes production experience');
      expect(user).toMatch(/no apology/);
    });

    it('omits gap block when absent', () => {
      const { user } = buildCoverLetterPrompts(BASE);
      expect(user).not.toMatch(/=== GAP TO ADDRESS ===/);
    });
  });
});

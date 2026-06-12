// Request body shapes for /api/interview/start + /api/interview/submit.
//
// Covers the cross-field refines (mode↔jobId, mode↔roleTitle) + length
// constraints. These are the only checks that run before BYOK + DB.

import { describe, it, expect } from 'vitest';
import {
  InterviewStartBody,
  InterviewSubmitBody,
} from '@/lib/schemas/interview-request';

const LLM = { provider: 'gemini', model: 'gemini-flash-latest', temperature: 0.3 } as const;

describe('InterviewStartBody', () => {
  it('accepts job_fit mode with jobId', () => {
    const r = InterviewStartBody.safeParse({
      llm: LLM,
      mode: 'job_fit',
      jobId: 'abc123',
      cvId: 'cv1',
      anchorRoleTitle: 'Backend Engineer',
    });
    expect(r.success).toBe(true);
  });

  it('rejects job_fit mode without jobId', () => {
    const r = InterviewStartBody.safeParse({
      llm: LLM,
      mode: 'job_fit',
      cvId: 'cv1',
      anchorRoleTitle: 'Backend Engineer',
    });
    expect(r.success).toBe(false);
  });

  it('accepts standalone mode with roleTitle', () => {
    const r = InterviewStartBody.safeParse({
      llm: LLM,
      mode: 'standalone',
      roleTitle: 'Senior PM',
      cvId: 'cv1',
      anchorRoleTitle: 'Product Manager',
    });
    expect(r.success).toBe(true);
  });

  it('rejects standalone mode without roleTitle', () => {
    const r = InterviewStartBody.safeParse({
      llm: LLM,
      mode: 'standalone',
      cvId: 'cv1',
      anchorRoleTitle: 'Product Manager',
    });
    expect(r.success).toBe(false);
  });

  it('rejects anchorRoleTitle shorter than 2 chars', () => {
    const r = InterviewStartBody.safeParse({
      llm: LLM,
      mode: 'standalone',
      roleTitle: 'Senior PM',
      cvId: 'cv1',
      anchorRoleTitle: 'a',
    });
    expect(r.success).toBe(false);
  });
});

describe('InterviewSubmitBody', () => {
  function makeAnswers() {
    return Array.from({ length: 10 }, (_, i) => ({
      id: `q${i + 1}`,
      answer: `Answer body for q${i + 1}`,
    }));
  }

  it('accepts 10 answers with q1..q10 ids', () => {
    const r = InterviewSubmitBody.safeParse({
      llm: LLM,
      sessionId: '00000000-0000-4000-8000-000000000000',
      answers: makeAnswers(),
    });
    expect(r.success).toBe(true);
  });

  it('rejects when fewer than 10 answers are provided', () => {
    const r = InterviewSubmitBody.safeParse({
      llm: LLM,
      sessionId: '00000000-0000-4000-8000-000000000000',
      answers: makeAnswers().slice(0, 9),
    });
    expect(r.success).toBe(false);
  });

  it('rejects an id outside q1..q10', () => {
    const answers = makeAnswers();
    answers[0] = { ...answers[0]!, id: 'q11' };
    const r = InterviewSubmitBody.safeParse({
      llm: LLM,
      sessionId: '00000000-0000-4000-8000-000000000000',
      answers,
    });
    expect(r.success).toBe(false);
  });

  it('rejects a non-UUID sessionId', () => {
    const r = InterviewSubmitBody.safeParse({
      llm: LLM,
      sessionId: 'not-a-uuid',
      answers: makeAnswers(),
    });
    expect(r.success).toBe(false);
  });

  it('rejects an empty answer', () => {
    const answers = makeAnswers();
    answers[0] = { ...answers[0]!, answer: '' };
    const r = InterviewSubmitBody.safeParse({
      llm: LLM,
      sessionId: '00000000-0000-4000-8000-000000000000',
      answers,
    });
    expect(r.success).toBe(false);
  });
});

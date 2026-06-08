import { describe, it, expect } from 'vitest';
import { scoreMustHaveAgainstChunks, chunkCvForEmbedding } from '@/lib/jd-matching/check-musthaves-semantic';

function vec(values: number[]): Float32Array {
  // cosineSim hard-loops 0..768 (gemini-embedding-001 dim) — pad + normalize
  // so test scores are deterministic.
  const padded = new Float32Array(768);
  for (let i = 0; i < values.length; i++) padded[i] = values[i]!;
  let norm = 0;
  for (let i = 0; i < padded.length; i++) norm += padded[i]! * padded[i]!;
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < padded.length; i++) padded[i] = padded[i]! / norm;
  return padded;
}

describe('scoreMustHaveAgainstChunks', () => {
  it('classifies matched at ≥0.65', () => {
    const reqVec = vec([1, 0, 0]);
    const chunks = [{ vector: vec([0.95, 0.1, 0]), text: 'Python expert with 5 years' }];
    const result = scoreMustHaveAgainstChunks('Python', reqVec, chunks);
    expect(result.status).toBe('matched');
    expect(result.score).toBeGreaterThanOrEqual(0.65);
    expect(result.evidenceSnippet).toContain('Python');
  });

  it('classifies partial at 0.45-0.65', () => {
    const reqVec = vec([1, 0, 0]);
    const chunks = [{ vector: vec([0.5, 0.8, 0]), text: 'Some scripting experience' }];
    const result = scoreMustHaveAgainstChunks('Python', reqVec, chunks);
    expect(result.status).toBe('partial');
  });

  it('classifies missing below 0.45', () => {
    const reqVec = vec([1, 0, 0]);
    const chunks = [{ vector: vec([0.2, 0.9, 0.3]), text: 'Marketing background' }];
    const result = scoreMustHaveAgainstChunks('Python', reqVec, chunks);
    expect(result.status).toBe('missing');
    expect(result.evidenceSnippet).toBeUndefined();
  });

  it('picks highest-scoring chunk', () => {
    const reqVec = vec([1, 0, 0]);
    const chunks = [
      { vector: vec([0.3, 1, 0]), text: 'Low match' },
      { vector: vec([0.98, 0.2, 0]), text: 'High match chunk' },
      { vector: vec([0.7, 0.5, 0]), text: 'Medium match' },
    ];
    const result = scoreMustHaveAgainstChunks('Python', reqVec, chunks);
    expect(result.evidenceSnippet).toContain('High match');
  });

  it('returns 0 score with no chunks', () => {
    const result = scoreMustHaveAgainstChunks('Python', vec([1, 0, 0]), []);
    expect(result.status).toBe('missing');
    expect(result.score).toBe(0);
  });
});

describe('chunkCvForEmbedding', () => {
  it('splits by detected section headers', () => {
    const cv = `John Doe\nSummary\nA senior engineer.\nExperience\nGoogle 2020-2024\nSkills\nPython, SQL`;
    const chunks = chunkCvForEmbedding(cv);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.some((c) => /Summary/i.test(c))).toBe(true);
    expect(chunks.some((c) => /Experience/i.test(c))).toBe(true);
    expect(chunks.some((c) => /Skills/i.test(c))).toBe(true);
  });

  it('detects Vietnamese headers', () => {
    const cv = `Nguyễn Văn A\nTóm tắt\nKỹ sư phần mềm.\nKinh nghiệm\nFPT 2020-2024\nKỹ năng\nJava`;
    const chunks = chunkCvForEmbedding(cv);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
  });

  it('falls back to fixed windows when no headers', () => {
    const cv = 'a'.repeat(1000);
    const chunks = chunkCvForEmbedding(cv);
    expect(chunks.length).toBe(Math.ceil(1000 / 400));
  });

});

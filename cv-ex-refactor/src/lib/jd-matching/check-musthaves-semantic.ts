/**
 * Semantic must-have check — embed each requirement, score against pre-chunked
 * CV vectors via cosine similarity, classify matched/partial/missing.
 *
 * Per design-intent.md decision #10:
 *   ≥0.65 → matched
 *   0.45–0.65 → partial
 *   <0.45 → missing
 *
 * Threshold rationale: gemini-embedding-001 normalized vectors typically yield
 * 0.5–0.75 for semantically-related sentences; 0.65 = "same competency phrased
 * differently"; 0.45 = "tangentially related". Tunable; revisit after pilot.
 *
 * Caller owns CV chunking + embedding (cached). This module only consumes
 * Float32Array vectors so it is testable without a network.
 */

import { embedText } from '@/lib/jobs/embed';
import { cosineSim } from '@/lib/jobs/score';

export type MustHaveStatus = 'matched' | 'partial' | 'missing';

export interface MustHaveCheckItem {
  requirement: string;
  status: MustHaveStatus;
  score: number;
  /** Snippet of CV chunk that produced the highest score, for UI evidence. */
  evidenceSnippet?: string;
}

export interface MustHaveCheckInput {
  requirement: string;
  /** Pre-embedded CV chunks. Caller is responsible for chunking + caching. */
  cvChunks: Array<{ vector: Float32Array; text: string }>;
}

const MATCHED_THRESHOLD = 0.65;
const PARTIAL_THRESHOLD = 0.45;
const SNIPPET_MAX = 180;

function classify(score: number): MustHaveStatus {
  if (score >= MATCHED_THRESHOLD) return 'matched';
  if (score >= PARTIAL_THRESHOLD) return 'partial';
  return 'missing';
}

function snippet(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length > SNIPPET_MAX ? trimmed.slice(0, SNIPPET_MAX) + '…' : trimmed;
}

/**
 * Score a single must-have vector against CV chunks. Pure — no I/O.
 * Useful for unit tests and offline backfills.
 */
export function scoreMustHaveAgainstChunks(
  requirement: string,
  vector: Float32Array,
  cvChunks: MustHaveCheckInput['cvChunks'],
): MustHaveCheckItem {
  let bestScore = 0;
  let bestText = '';
  for (const chunk of cvChunks) {
    const sim = cosineSim(vector, chunk.vector);
    if (sim > bestScore) {
      bestScore = sim;
      bestText = chunk.text;
    }
  }
  const status = classify(bestScore);
  const item: MustHaveCheckItem = {
    requirement,
    status,
    score: Math.round(bestScore * 1000) / 1000,
  };
  if (bestText && status !== 'missing') item.evidenceSnippet = snippet(bestText);
  return item;
}

/**
 * Embed each must-have and score against the pre-chunked CV.
 * Returns ordered (matched → partial → missing then by score desc).
 */
export async function checkMustHavesSemantic(
  mustHaves: string[],
  cvChunks: MustHaveCheckInput['cvChunks'],
  apiKey: string,
  externalSignal?: AbortSignal,
): Promise<MustHaveCheckItem[]> {
  if (mustHaves.length === 0 || cvChunks.length === 0) return [];

  // Embed sequentially — embed.ts has internal throttling (rate window).
  // Parallel would race the limiter; we trade <1s latency for stability.
  const results: MustHaveCheckItem[] = [];
  for (const req of mustHaves) {
    const trimmed = req.trim();
    if (!trimmed) continue;
    const vec = await embedText(trimmed, apiKey, externalSignal);
    results.push(scoreMustHaveAgainstChunks(trimmed, vec, cvChunks));
  }

  const order: Record<MustHaveStatus, number> = { matched: 0, partial: 1, missing: 2 };
  return results.sort((a, b) => {
    const d = order[a.status] - order[b.status];
    return d !== 0 ? d : b.score - a.score;
  });
}

/**
 * Sectionable CV chunker — splits by common header lines so each chunk holds
 * one logical bucket (experience / skills / education). Falls back to raw
 * 400-char chunks when no headers detected.
 */
export function chunkCvForEmbedding(cvText: string): string[] {
  const HEADER_RE = /^(?:professional\s+|work\s+)?(experience|skills?|education|projects?|summary|certifications?|languages?|kinh\s*nghiệm|kỹ\s*năng|học\s*vấn|dự\s*án|tóm\s*tắt)\s*:?\s*$/i;
  const lines = cvText.replace(/\r\n/g, '\n').split('\n');

  const chunks: string[] = [];
  let current: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length > 0 && line.length <= 60 && HEADER_RE.test(line)) {
      if (current.length > 0) chunks.push(current.join('\n').trim());
      current = [line];
    } else {
      current.push(raw);
    }
  }
  if (current.length > 0) chunks.push(current.join('\n').trim());

  // No headers detected → fall back to fixed-size windows
  if (chunks.length <= 1) {
    return windowChunks(cvText, 400);
  }
  return chunks.filter((c) => c.length > 8);
}

function windowChunks(text: string, size: number): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= size) return [cleaned];
  const out: string[] = [];
  for (let i = 0; i < cleaned.length; i += size) {
    out.push(cleaned.slice(i, i + size));
  }
  return out;
}

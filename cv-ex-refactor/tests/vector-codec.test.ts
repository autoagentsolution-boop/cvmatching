// Vector codec round-trip + boundary cases. Phase 2 of jobfit-db-pool-monetize.
//
// pgvector stores float4 (32-bit IEEE-754), bytewise identical to Float32Array,
// so the only precision risk is decimal-string serialization in float32ToPgVector.
// We bound max abs error at 1e-7 — empirically tight for L2-normalized
// Gemini gemini-embedding-001 outputs.

import { describe, expect, it } from 'vitest';
import {
  VectorDecodeError,
  base64ToPgVector,
  float32ToPgVector,
  pgVectorToFloat32,
} from '@/lib/jobs/vector-codec';

const DIM = 768;

function randomVec(seed = 42): Float32Array {
  // Deterministic xorshift32 — no Math.random so tests are reproducible.
  let s = seed >>> 0;
  const out = new Float32Array(DIM);
  for (let i = 0; i < DIM; i++) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    // Normalize to [-1, 1].
    out[i] = (s | 0) / 2 ** 31;
  }
  return out;
}

describe('vector-codec', () => {
  describe('float32ToPgVector', () => {
    it('emits canonical [a,b,c,...] form with no spaces', () => {
      const v = new Float32Array(DIM);
      v[0] = 0.5;
      v[1] = -0.25;
      const lit = float32ToPgVector(v);
      expect(lit.startsWith('[')).toBe(true);
      expect(lit.endsWith(']')).toBe(true);
      expect(lit.includes(' ')).toBe(false);
      expect(lit.split(',').length).toBe(DIM);
    });

    it('throws VectorDecodeError on wrong dimension', () => {
      expect(() => float32ToPgVector(new Float32Array(100))).toThrow(VectorDecodeError);
      expect(() => float32ToPgVector(new Float32Array(769))).toThrow(VectorDecodeError);
    });
  });

  describe('pgVectorToFloat32', () => {
    it('parses canonical form back to Float32Array of correct length', () => {
      const lit = float32ToPgVector(randomVec());
      const parsed = pgVectorToFloat32(lit);
      expect(parsed).toBeInstanceOf(Float32Array);
      expect(parsed.length).toBe(DIM);
    });

    it('tolerates surrounding whitespace', () => {
      const lit = float32ToPgVector(randomVec(7));
      expect(() => pgVectorToFloat32(`  ${lit}\n`)).not.toThrow();
    });

    it('throws on missing brackets', () => {
      expect(() => pgVectorToFloat32('1,2,3')).toThrow(VectorDecodeError);
    });

    it('throws on wrong component count', () => {
      expect(() => pgVectorToFloat32('[1,2,3]')).toThrow(VectorDecodeError);
    });

    it('throws on NaN / non-finite component', () => {
      const parts = new Array(DIM).fill('0');
      parts[0] = 'foo';
      expect(() => pgVectorToFloat32(`[${parts.join(',')}]`)).toThrow(VectorDecodeError);
    });
  });

  describe('round-trip Float32Array → pgvector → Float32Array', () => {
    it('preserves values within 1e-7 for 5 random seeds', () => {
      for (const seed of [1, 42, 1337, 4242, 99999]) {
        const original = randomVec(seed);
        const lit = float32ToPgVector(original);
        const round = pgVectorToFloat32(lit);
        let maxDelta = 0;
        for (let i = 0; i < DIM; i++) {
          const d = Math.abs(original[i]! - round[i]!);
          if (d > maxDelta) maxDelta = d;
        }
        expect(maxDelta).toBeLessThan(1e-7);
      }
    });

    it('round-trip preserves exactly for values directly representable in float32', () => {
      const v = new Float32Array(DIM);
      // 0, 0.5, 0.25 — all exact in IEEE-754 float32.
      for (let i = 0; i < DIM; i++) v[i] = (i % 3 === 0) ? 0 : (i % 3 === 1) ? 0.5 : -0.25;
      const round = pgVectorToFloat32(float32ToPgVector(v));
      for (let i = 0; i < DIM; i++) expect(round[i]).toBe(v[i]);
    });
  });

  describe('base64ToPgVector', () => {
    it('round-trips through base64 → pgvector → Float32Array', () => {
      const original = randomVec(2026);
      const buf = Buffer.alloc(DIM * 4);
      for (let i = 0; i < DIM; i++) buf.writeFloatLE(original[i]!, i * 4);
      const b64 = buf.toString('base64');

      const lit = base64ToPgVector(b64);
      const parsed = pgVectorToFloat32(lit);

      let maxDelta = 0;
      for (let i = 0; i < DIM; i++) {
        const d = Math.abs(original[i]! - parsed[i]!);
        if (d > maxDelta) maxDelta = d;
      }
      expect(maxDelta).toBeLessThan(1e-7);
    });

    it('throws on wrong byte length', () => {
      const tooSmall = Buffer.alloc(100).toString('base64');
      expect(() => base64ToPgVector(tooSmall)).toThrow(VectorDecodeError);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { cosineSim } from '@/lib/jobs/score';

const DIM = 768;

function makeVec(fillValue: number): Float32Array {
  return new Float32Array(DIM).fill(fillValue);
}

function normalizedVec(values: number[]): Float32Array {
  const arr = new Float32Array(values);
  let norm = 0;
  for (let i = 0; i < arr.length; i++) norm += arr[i]! * arr[i]!;
  norm = Math.sqrt(norm);
  for (let i = 0; i < arr.length; i++) arr[i] = arr[i]! / norm;
  return arr;
}

describe('cosineSim', () => {
  it('identical unit vectors → 1.0', () => {
    const a = new Float32Array(DIM).fill(0);
    // single non-zero component → unit vector
    a[0] = 1.0;
    const b = new Float32Array(DIM).fill(0);
    b[0] = 1.0;
    expect(cosineSim(a, b)).toBeCloseTo(1.0, 5);
  });

  it('orthogonal vectors → 0.0', () => {
    const a = new Float32Array(DIM).fill(0);
    a[0] = 1.0;
    const b = new Float32Array(DIM).fill(0);
    b[1] = 1.0;
    expect(cosineSim(a, b)).toBeCloseTo(0.0, 5);
  });

  it('opposite unit vectors → -1.0', () => {
    const a = new Float32Array(DIM).fill(0);
    a[0] = 1.0;
    const b = new Float32Array(DIM).fill(0);
    b[0] = -1.0;
    expect(cosineSim(a, b)).toBeCloseTo(-1.0, 5);
  });

  it('known normalized vectors yield expected dot product', () => {
    // Two 2-component vectors extended to 768 dims (rest zero):
    // a = [1/√2, 1/√2, 0, …], b = [1/√2, -1/√2, 0, …] → cos = 0
    const a = new Float32Array(DIM).fill(0);
    a[0] = 1 / Math.sqrt(2);
    a[1] = 1 / Math.sqrt(2);
    const b = new Float32Array(DIM).fill(0);
    b[0] = 1 / Math.sqrt(2);
    b[1] = -1 / Math.sqrt(2);
    expect(cosineSim(a, b)).toBeCloseTo(0.0, 5);
  });

  it('uniform vectors: dot product equals sum of squares (all positive)', () => {
    // All components equal 1/√768 → unit vector → dot with itself = 1
    const val = 1 / Math.sqrt(DIM);
    const a = makeVec(val);
    expect(cosineSim(a, a)).toBeCloseTo(1.0, 4);
  });

  it('normalized random-ish vectors lie in [-1, 1]', () => {
    const values: number[] = [];
    for (let i = 0; i < DIM; i++) values.push(Math.sin(i * 0.1));
    const a = normalizedVec(values);
    const bValues: number[] = [];
    for (let i = 0; i < DIM; i++) bValues.push(Math.cos(i * 0.1));
    const b = normalizedVec(bValues);
    const sim = cosineSim(a, b);
    expect(sim).toBeGreaterThanOrEqual(-1.0);
    expect(sim).toBeLessThanOrEqual(1.0);
  });
});

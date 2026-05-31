// Roundtrip smoke test for pack-embeddings.ts.
// Verifies Float32 pack → unpack fidelity within Float32 precision (epsilon 1e-6).
// Does NOT touch KV — pure in-memory.

import { describe, it, expect } from 'vitest';
import { packEmbeddings, unpackChunk, unpackAllChunks } from '@/lib/jobs/pack-embeddings';

const FLOATS = 768;
const EPSILON = 1e-6;

function makeEntry(id: string, seed: number): { id: string; embedding: Float32Array } {
  // Fill with Math.sin values so floats cover negative, positive, and fractional range.
  const arr = new Float32Array(FLOATS);
  for (let i = 0; i < FLOATS; i++) {
    arr[i] = Math.sin(seed + i * 0.01);
  }
  return { id, embedding: arr };
}

function assertClose(a: Float32Array, b: Float32Array, label: string): void {
  expect(a.length, `${label}: length mismatch`).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    expect(Math.abs(a[i]! - b[i]!)).toBeLessThan(EPSILON);
  }
}

describe('packEmbeddings / unpackChunk', () => {
  it('roundtrips 3 entries within Float32 epsilon', () => {
    const entries = [
      makeEntry('aabbccdd00112233', 0),
      makeEntry('deadbeef11223344', 1),
      makeEntry('cafebabe99887766', 2),
    ];

    const { idsByChunk, blobChunks } = packEmbeddings(entries, 250);

    expect(blobChunks.length).toBe(1);
    expect(idsByChunk[0]).toEqual(entries.map((e) => e.id));

    const unpacked = unpackChunk(blobChunks[0]!, idsByChunk[0]!);

    expect(unpacked.size).toBe(3);

    for (const entry of entries) {
      const result = unpacked.get(entry.id);
      expect(result, `entry ${entry.id} missing from unpacked map`).toBeDefined();
      assertClose(entry.embedding, result!, entry.id);
    }
  });

  it('preserves id alignment across chunk boundary', () => {
    // Force 2 chunks by setting chunkSize=2 with 3 entries
    const entries = [
      makeEntry('id-chunk0-a', 10),
      makeEntry('id-chunk0-b', 20),
      makeEntry('id-chunk1-a', 30),
    ];

    const { idsByChunk, blobChunks } = packEmbeddings(entries, 2);

    expect(blobChunks.length).toBe(2);
    expect(idsByChunk[0]).toEqual(['id-chunk0-a', 'id-chunk0-b']);
    expect(idsByChunk[1]).toEqual(['id-chunk1-a']);

    const all = unpackAllChunks(blobChunks, idsByChunk);

    expect(all.size).toBe(3);

    for (const entry of entries) {
      const result = all.get(entry.id);
      expect(result, `entry ${entry.id} missing`).toBeDefined();
      assertClose(entry.embedding, result!, entry.id);
    }
  });

  it('throws on wrong embedding length', () => {
    const bad = { id: 'bad-entry', embedding: new Float32Array(4) }; // wrong dim
    expect(() => packEmbeddings([bad])).toThrow(/expected 768/);
  });

  it('returns empty result for empty input', () => {
    const { idsByChunk, blobChunks } = packEmbeddings([]);
    expect(idsByChunk).toEqual([]);
    expect(blobChunks).toEqual([]);
  });
});

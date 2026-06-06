// Float32Array ↔ pgvector wire format codec.
//
// pgvector accepts a string literal `'[v1,v2,...,vN]'` for INSERT/UPDATE and
// emits the same shape on SELECT. We keep embeddings as Float32Array in
// memory (matches the existing Gemini gemini-embedding-001 pipeline in
// embed.ts; L2-normalized) and convert at the SQL boundary.
//
// Round-trip precision: pgvector stores each component as float4 (32-bit
// IEEE-754), bytewise identical to Float32Array. So delta is bounded by the
// decimal-string serialization, not by storage. We use full precision
// (Number.prototype.toString — emits up to 17 significant digits) to keep
// round-trip error below 1e-7.

const VECTOR_DIM = 768;

export class VectorDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VectorDecodeError';
  }
}

/**
 * Serialize a 768-dim Float32Array to the pgvector literal `'[...]'` form.
 * Throws if the dimension does not match the schema (`vector(768)`).
 */
export function float32ToPgVector(embedding: Float32Array): string {
  if (embedding.length !== VECTOR_DIM) {
    throw new VectorDecodeError(
      `Expected ${VECTOR_DIM}-dim vector, got ${embedding.length}`,
    );
  }
  // toString() emits the shortest precise representation. Faster than
  // toFixed/toPrecision for large arrays.
  const parts = new Array<string>(embedding.length);
  for (let i = 0; i < embedding.length; i++) {
    parts[i] = String(embedding[i]);
  }
  return `[${parts.join(',')}]`;
}

/**
 * Parse a pgvector literal back to Float32Array. Accepts the canonical
 * `'[v1,v2,...,vN]'` form pgvector emits via SELECT. Whitespace tolerant.
 */
export function pgVectorToFloat32(literal: string): Float32Array {
  const trimmed = literal.trim();
  if (trimmed.length < 2 || trimmed[0] !== '[' || trimmed[trimmed.length - 1] !== ']') {
    throw new VectorDecodeError(`Invalid pgvector literal: missing brackets`);
  }
  const inner = trimmed.slice(1, -1);
  if (inner.length === 0) {
    throw new VectorDecodeError('Empty pgvector literal');
  }
  const parts = inner.split(',');
  if (parts.length !== VECTOR_DIM) {
    throw new VectorDecodeError(
      `Expected ${VECTOR_DIM} components, got ${parts.length}`,
    );
  }
  const out = new Float32Array(VECTOR_DIM);
  for (let i = 0; i < VECTOR_DIM; i++) {
    const n = Number(parts[i]);
    if (!Number.isFinite(n)) {
      throw new VectorDecodeError(`Non-finite component at index ${i}: "${parts[i]}"`);
    }
    out[i] = n;
  }
  return out;
}

/**
 * Convert the existing KV-resident base64-encoded Float32Array (32-bit, LE)
 * to the pgvector literal form. Used by the migration script (Phase 3) so it
 * never has to round-trip through Float32Array unnecessarily.
 */
export function base64ToPgVector(base64: string): string {
  const buf = Buffer.from(base64, 'base64');
  if (buf.byteLength !== VECTOR_DIM * 4) {
    throw new VectorDecodeError(
      `Expected ${VECTOR_DIM * 4} bytes (${VECTOR_DIM}×float32), got ${buf.byteLength}`,
    );
  }
  // Use a Float32Array view over the buffer; matches the existing embed.ts
  // serialization which writes the LE byte layout of a Float32Array directly.
  const view = new Float32Array(buf.buffer, buf.byteOffset, VECTOR_DIM);
  return float32ToPgVector(view);
}

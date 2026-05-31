// Pack/unpack chunked Float32Array(768) embedding blobs for KV storage.
//
// Chunk layout: [f32 × 768] × N, little-endian.
// ids[i] aligns with chunk offset i * 3072 (768 floats × 4 bytes).
// No per-entry header — id list is stored separately in embeddings:active:v<n>:ids.
//
// Why chunked: 250 entries × 3072 B = 768 KB raw → ~1 MB base64.
// Upstash REST value limit is several MB, but chunking by design allows
// scaling past 250 jobs without format change.

const FLOATS_PER_ENTRY = 768;
const BYTES_PER_ENTRY = FLOATS_PER_ENTRY * 4; // Float32 = 4 bytes

export interface PackResult {
  idsByChunk: string[][];
  blobChunks: Buffer[];
}

/**
 * Pack embedding entries into contiguous binary chunks.
 * Each chunk holds up to `chunkSize` entries packed as little-endian Float32.
 */
export function packEmbeddings(
  entries: Array<{ id: string; embedding: Float32Array }>,
  chunkSize = 250,
): PackResult {
  if (entries.length === 0) return { idsByChunk: [], blobChunks: [] };

  const idsByChunk: string[][] = [];
  const blobChunks: Buffer[] = [];

  for (let start = 0; start < entries.length; start += chunkSize) {
    const slice = entries.slice(start, start + chunkSize);
    const buf = Buffer.alloc(slice.length * BYTES_PER_ENTRY);

    for (let i = 0; i < slice.length; i++) {
      const emb = slice[i]!.embedding;
      if (emb.length !== FLOATS_PER_ENTRY) {
        throw new Error(
          `Entry "${slice[i]!.id}" has ${emb.length} floats; expected ${FLOATS_PER_ENTRY}`,
        );
      }
      const base = i * BYTES_PER_ENTRY;
      for (let j = 0; j < FLOATS_PER_ENTRY; j++) {
        buf.writeFloatLE(emb[j]!, base + j * 4);
      }
    }

    idsByChunk.push(slice.map((e) => e.id));
    blobChunks.push(buf);
  }

  return { idsByChunk, blobChunks };
}

/**
 * Unpack a single chunk blob back into a Map<id, Float32Array>.
 * `ids` must be the ids list for this chunk (same order as packed).
 */
export function unpackChunk(blob: Buffer, ids: string[]): Map<string, Float32Array> {
  const expected = ids.length * BYTES_PER_ENTRY;
  if (blob.length !== expected) {
    throw new Error(`Blob length ${blob.length} does not match ${ids.length} ids (expected ${expected} bytes)`);
  }

  const result = new Map<string, Float32Array>();
  for (let i = 0; i < ids.length; i++) {
    const arr = new Float32Array(FLOATS_PER_ENTRY);
    const base = i * BYTES_PER_ENTRY;
    for (let j = 0; j < FLOATS_PER_ENTRY; j++) {
      arr[j] = blob.readFloatLE(base + j * 4);
    }
    result.set(ids[i]!, arr);
  }
  return result;
}

/**
 * Unpack all chunks into a single Map<id, Float32Array>.
 * `idsByChunk[i]` must correspond to `blobChunks[i]`.
 */
export function unpackAllChunks(
  blobChunks: Buffer[],
  idsByChunk: string[][],
): Map<string, Float32Array> {
  const result = new Map<string, Float32Array>();
  for (let i = 0; i < blobChunks.length; i++) {
    const chunk = unpackChunk(blobChunks[i]!, idsByChunk[i]!);
    for (const [id, emb] of chunk) {
      result.set(id, emb);
    }
  }
  return result;
}

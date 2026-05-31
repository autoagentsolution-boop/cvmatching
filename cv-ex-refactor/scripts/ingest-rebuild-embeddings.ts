// Rebuild the chunked embedding blob from all active jobs.
// Determines next version (v1 → v2 → ...), packs embeddings, saves chunks + meta,
// then atomically flips embeddings:active:current to the new version.

import {
  listActiveIds,
  getJob,
  getActiveBlobVersion,
  setActiveBlobVersion,
  saveBlobChunk,
  saveBlobMeta,
} from '../src/lib/jobs/repo.js';
import { packEmbeddings } from '../src/lib/jobs/pack-embeddings.js';

function nextVersion(current: string | null): string {
  if (!current) return 'v1';
  const match = current.match(/^v(\d+)$/);
  if (!match) return 'v1';
  return `v${parseInt(match[1]!, 10) + 1}`;
}

export async function run(): Promise<void> {
  console.log('[rebuild-embeddings] Loading active job ids...');
  const ids = await listActiveIds();

  if (ids.length === 0) {
    console.log('[rebuild-embeddings] No active jobs found. Nothing to rebuild.');
    return;
  }

  console.log(`[rebuild-embeddings] Loading embeddings for ${ids.length} jobs...`);

  const entries: Array<{ id: string; embedding: Float32Array }> = [];

  for (const id of ids) {
    const job = await getJob(id);
    if (!job) {
      console.warn(`[rebuild-embeddings] Warning: job ${id} in active set but missing from KV — skipping`);
      continue;
    }
    if (!job.embedding) {
      console.warn(`[rebuild-embeddings] Warning: job ${id} has no embedding — skipping`);
      continue;
    }
    const buf = Buffer.from(job.embedding, 'base64');
    const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    // Copy to detached Float32Array (buf may be a shared backing store)
    entries.push({ id, embedding: Float32Array.from(arr) });
  }

  console.log(`[rebuild-embeddings] Packing ${entries.length} embeddings...`);
  const { idsByChunk, blobChunks } = packEmbeddings(entries);

  const currentVersion = await getActiveBlobVersion();
  const newVersion = nextVersion(currentVersion);

  console.log(`[rebuild-embeddings] Writing ${blobChunks.length} chunk(s) as ${newVersion}...`);

  // Flatten all ids in chunk order for the ids meta key
  const allIds = idsByChunk.flat();

  for (let i = 0; i < blobChunks.length; i++) {
    const base64 = blobChunks[i]!.toString('base64');
    await saveBlobChunk(newVersion, i, base64);
    console.log(`[rebuild-embeddings]   chunk ${i}: ${idsByChunk[i]!.length} entries, ${base64.length} base64 chars`);
  }

  await saveBlobMeta(newVersion, allIds, blobChunks.length);

  // Atomic pointer flip — consumers reading embeddings:active:current get new version
  await setActiveBlobVersion(newVersion);

  console.log(
    `[rebuild-embeddings] Done. Active blob: ${newVersion} | ${entries.length} jobs | ${blobChunks.length} chunk(s)`,
  );
  if (currentVersion) {
    console.log(`[rebuild-embeddings] Previous version ${currentVersion} keys remain in KV (manual cleanup if needed)`);
  }
}

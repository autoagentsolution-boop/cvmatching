// Batch file ingest: reads a JSON array of partial job objects, deduplicates
// by sourceUrl against jobs:active, classifies, embeds, and saves each entry.
// Writes data/ingest-progress.json on SIGINT for resume capability.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import crypto from 'node:crypto';
import { classifyVertical, classifySeniority } from '../src/lib/jobs/classify.js';
import { embedText } from '../src/lib/jobs/embed.js';
import { saveJob, isActiveJob } from '../src/lib/jobs/repo.js';
import type { Job, JobInput } from '../src/lib/jobs/types.js';

const PROGRESS_PATH = resolve(process.cwd(), 'data/ingest-progress.json');

function sha256Id(sourceUrl: string): string {
  return crypto.createHash('sha256').update(sourceUrl).digest('hex').slice(0, 16);
}

export async function run(args: string[]): Promise<void> {
  const filePath = args[0];
  if (!filePath) {
    console.error('[ingest file] Usage: pnpm run ingest file <path>');
    process.exit(1);
  }

  const absPath = resolve(process.cwd(), filePath);
  let entries: JobInput[];
  try {
    const raw = readFileSync(absPath, 'utf-8');
    entries = JSON.parse(raw) as JobInput[];
  } catch (err) {
    console.error(`[ingest file] Cannot read "${absPath}": ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    console.error('[ingest file] File must contain a non-empty JSON array.');
    process.exit(1);
  }

  const apiKey = process.env['GEMINI_API_KEY']!;
  const total = entries.length;
  let lastIndex = -1;
  let saved = 0;
  let skipped = 0;

  // Graceful SIGINT: write progress so operator can resume
  process.on('SIGINT', () => {
    writeFileSync(
      PROGRESS_PATH,
      JSON.stringify({ lastIndex, savedCount: saved, skippedCount: skipped }, null, 2),
    );
    console.log(`\n[ingest file] Interrupted. Progress saved to ${PROGRESS_PATH}`);
    process.exit(0);
  });

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    lastIndex = i;

    if (!entry.sourceUrl) {
      console.warn(`[ingest file] [${i + 1}/${total}] Skipping entry with missing sourceUrl`);
      skipped++;
      continue;
    }

    const id = sha256Id(entry.sourceUrl);

    // Dedup: skip if already in jobs:active
    const exists = await isActiveJob(id);
    if (exists) {
      console.log(`[ingest file] [${i + 1}/${total}] Skip dup: ${entry.title ?? id}`);
      skipped++;
      continue;
    }

    const vertical = entry.vertical ?? classifyVertical(entry.title ?? '', entry.company ?? '');
    const seniority = entry.seniority ?? classifySeniority(entry.title ?? '');

    console.log(`[ingest file] [${i + 1}/${total}] Embedding: ${entry.title} @ ${entry.company}`);

    const embeddingArr = await embedText(`${entry.title} ${entry.description}`, apiKey);
    const embedding = Buffer.from(embeddingArr.buffer).toString('base64');

    const job: Job = {
      id,
      title: entry.title,
      company: entry.company,
      vertical,
      seniority,
      description: entry.description,
      sourceUrl: entry.sourceUrl,
      source: entry.source,
      location: entry.location,
      postedAt: entry.postedAt,
      verifiedAt: new Date().toISOString(),
      embedding,
    };

    await saveJob(job);
    saved++;
  }

  console.log(`\n[ingest file] Done. Saved: ${saved}, Skipped: ${skipped}, Total: ${total}`);
}

// Batch file ingest: reads a JSON array of partial job objects, deduplicates
// by sourceUrl against jobs:active, classifies, embeds, and saves each entry.
// Writes data/ingest-progress.json on SIGINT for resume capability.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import crypto from 'node:crypto';
import { classifyVerticalAndSub, classifySeniority } from '../src/lib/jobs/classify.js';
import { embedText } from '../src/lib/jobs/embed.js';
import { saveJob, isActiveJob } from '../src/lib/jobs/repo.js';
import type { Job, JobInput } from '../src/lib/jobs/types.js';
import { resolveCompany } from '../src/lib/companies/alias-resolver.js';
import { addActiveJob } from '../src/lib/companies/kv-client.js';
import { fireTier1Scrape } from '../src/lib/companies/tier1-fire.js';

const PROGRESS_PATH = resolve(process.cwd(), 'data/ingest-progress.json');

function sha256Id(sourceUrl: string): string {
  return crypto.createHash('sha256').update(sourceUrl).digest('hex').slice(0, 16);
}

/**
 * Shared per-entry ingest loop. Used by `ingest file` (JSON array on disk)
 * and `ingest urls` (URLs → JSON-LD → JobInput[]). Logs prefix `tag` for
 * caller attribution. Writes resume progress on SIGINT.
 */
export async function ingestEntries(
  entries: JobInput[],
  tag = 'ingest file',
): Promise<{ saved: number; skipped: number; total: number }> {
  const apiKey = process.env['GEMINI_API_KEY']!;
  const total = entries.length;
  let lastIndex = -1;
  let saved = 0;
  let skipped = 0;

  const onSigint = (): void => {
    writeFileSync(
      PROGRESS_PATH,
      JSON.stringify({ lastIndex, savedCount: saved, skippedCount: skipped }, null, 2),
    );
    console.log(`\n[${tag}] Interrupted. Progress saved to ${PROGRESS_PATH}`);
    process.exit(0);
  };
  process.on('SIGINT', onSigint);

  try {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      lastIndex = i;

      if (!entry.sourceUrl) {
        console.warn(`[${tag}] [${i + 1}/${total}] Skipping entry with missing sourceUrl`);
        skipped++;
        continue;
      }

      const id = sha256Id(entry.sourceUrl);

      const exists = await isActiveJob(id);
      if (exists) {
        console.log(`[${tag}] [${i + 1}/${total}] Skip dup: ${entry.title ?? id}`);
        skipped++;
        continue;
      }

      // Prefer caller-supplied vertical/subVertical (scrape pipeline knows
      // them exactly from taxonomy pre-filter); fall back to classifier on
      // the (title, company) pair for paste/url/manual inputs.
      const classified = classifyVerticalAndSub(entry.title ?? '', entry.company ?? '');
      const vertical = entry.vertical ?? classified.vertical;
      const subVertical = entry.subVertical ?? classified.subVertical;
      const seniority = entry.seniority ?? classifySeniority(entry.title ?? '');

      console.log(`[${tag}] [${i + 1}/${total}] Embedding: ${entry.title} @ ${entry.company}`);

      const embeddingArr = await embedText(`${entry.title} ${entry.description}`, apiKey);
      const embedding = Buffer.from(embeddingArr.buffer).toString('base64');

      let companyId: string | undefined;
      let companyCreated = false;
      try {
        const resolved = await resolveCompany(entry.company, {
          llm: { provider: 'gemini', model: 'gemini-2.5-flash', temperature: 0, apiKey },
          sourceUrl: entry.sourceCompanyUrl ?? entry.sourceUrl,
        });
        companyId = resolved.slug;
        companyCreated = resolved.created;
      } catch (err) {
        console.warn(
          `[${tag}] [${i + 1}/${total}] resolveCompany failed for "${entry.company}": ${
            err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120)
          } — proceeding without companyId`,
        );
      }

      const job: Job = {
        id,
        title: entry.title,
        company: entry.company,
        ...(companyId ? { companyId } : {}),
        vertical,
        ...(subVertical ? { subVertical } : {}),
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
      if (companyId) {
        await addActiveJob(companyId, id);

        if (entry.source === 'itviec' && entry.sourceCompanyUrl) {
          const tier1 = await fireTier1Scrape({
            source: entry.source,
            sourceCompanyUrl: entry.sourceCompanyUrl,
            slug: companyId,
            created: companyCreated,
          });
          if (tier1.ok) {
            console.log(`[${tag}] [${i + 1}/${total}] Tier 1 populated (${tier1.fieldCount}/6)`);
          } else if (tier1.fired) {
            console.warn(`[${tag}] [${i + 1}/${total}] Tier 1 scrape failed: ${tier1.reason}`);
          }
        }
      }
      saved++;
    }
  } finally {
    process.off('SIGINT', onSigint);
  }

  console.log(`\n[${tag}] Done. Saved: ${saved}, Skipped: ${skipped}, Total: ${total}`);
  return { saved, skipped, total };
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

  await ingestEntries(entries, 'ingest file');
}

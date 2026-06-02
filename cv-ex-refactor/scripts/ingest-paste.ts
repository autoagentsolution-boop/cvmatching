// Interactive single-job paste flow.
// Prompts operator for all fields, classifies vertical/seniority, embeds, confirms, saves.

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import crypto from 'node:crypto';
import { classifyVertical, classifySeniority } from '../src/lib/jobs/classify.js';
import { embedText } from '../src/lib/jobs/embed.js';
import { saveJob } from '../src/lib/jobs/repo.js';
import type { Job } from '../src/lib/jobs/types.js';

function sha256Id(sourceUrl: string): string {
  return crypto.createHash('sha256').update(sourceUrl).digest('hex').slice(0, 16);
}

async function prompt(rl: Awaited<ReturnType<typeof createInterface>>, question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

export async function run(_args: string[]): Promise<void> {
  const rl = createInterface({ input, output });

  try {
    console.log('\n[ingest paste] Enter job details (Ctrl+C to cancel)\n');

    const title = await prompt(rl, 'Title: ');
    const company = await prompt(rl, 'Company: ');
    const description = await prompt(rl, 'Description (paste, then Enter): ');
    const sourceUrl = await prompt(rl, 'Source URL: ');
    const sourceRaw = await prompt(rl, 'Source (itviec/topcv/vnw/vl24h/other) [other]: ') || 'other';
    const location = await prompt(rl, 'Location (e.g. Hồ Chí Minh): ');
    const postedAt = await prompt(rl, 'Posted at (ISO date, e.g. 2026-05-15): ');

    const source = (['itviec', 'topcv', 'vnw', 'vl24h', 'other'].includes(sourceRaw)
      ? sourceRaw
      : 'other') as Job['source'];

    const vertical = classifyVertical(title, company);
    const seniority = classifySeniority(title);
    const id = sha256Id(sourceUrl);

    console.log('\n--- Classified ---');
    console.log(`  id:         ${id}`);
    console.log(`  vertical:   ${vertical}`);
    console.log(`  seniority:  ${seniority}`);

    const confirm = await prompt(rl, '\nEmbed and save? [y/N]: ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('[ingest paste] Aborted.');
      return;
    }

    const apiKey = process.env['GEMINI_API_KEY']!;
    console.log('[ingest paste] Embedding...');
    const embeddingArr = await embedText(`${title} ${description}`, apiKey);
    const embedding = Buffer.from(embeddingArr.buffer).toString('base64');

    const job: Job = {
      id,
      title,
      company,
      vertical,
      seniority,
      description,
      sourceUrl,
      source,
      location,
      postedAt,
      verifiedAt: new Date().toISOString(),
      embedding,
    };

    await saveJob(job);
    console.log(`[ingest paste] Saved job ${id} (${title} @ ${company})`);
  } finally {
    rl.close();
  }
}

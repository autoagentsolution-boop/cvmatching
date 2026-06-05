// Interactive single-job paste flow.
// Prompts operator for all fields, classifies vertical/seniority, embeds, confirms, saves.

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import crypto from 'node:crypto';
import { classifyVerticalAndSub, classifySeniority } from '../src/lib/jobs/classify.js';
import { embedText } from '../src/lib/jobs/embed.js';
import { saveJob } from '../src/lib/jobs/repo.js';
import type { Job } from '../src/lib/jobs/types.js';
import { resolveCompany } from '../src/lib/companies/alias-resolver.js';
import { addActiveJob } from '../src/lib/companies/kv-client.js';
import { fireTier1Scrape } from '../src/lib/companies/tier1-fire.js';

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
    const sourceCompanyUrl = await prompt(rl, 'Source company URL (optional, ITviec only): ');
    const location = await prompt(rl, 'Location (e.g. Hồ Chí Minh): ');
    const postedAt = await prompt(rl, 'Posted at (ISO date, e.g. 2026-05-15): ');

    const source = (['itviec', 'topcv', 'vnw', 'vl24h', 'other'].includes(sourceRaw)
      ? sourceRaw
      : 'other') as Job['source'];

    const { vertical, subVertical } = classifyVerticalAndSub(title, company);
    const seniority = classifySeniority(title);
    const id = sha256Id(sourceUrl);

    console.log('\n--- Classified ---');
    console.log(`  id:           ${id}`);
    console.log(`  vertical:     ${vertical}`);
    console.log(`  subVertical:  ${subVertical ?? '(none)'}`);
    console.log(`  seniority:    ${seniority}`);

    const confirm = await prompt(rl, '\nEmbed and save? [y/N]: ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('[ingest paste] Aborted.');
      return;
    }

    const apiKey = process.env['GEMINI_API_KEY']!;
    console.log('[ingest paste] Embedding...');
    const embeddingArr = await embedText(`${title} ${description}`, apiKey);
    const embedding = Buffer.from(embeddingArr.buffer).toString('base64');

    // v0.4 Phase 02 — best-effort Company entity resolve. Failure here
    // does not abort the Job save; companyId stays undefined for retry.
    let companyId: string | undefined;
    try {
      const resolved = await resolveCompany(company, {
        llm: { provider: 'gemini', model: 'gemini-2.5-flash', temperature: 0, apiKey },
        sourceUrl,
      });
      companyId = resolved.slug;
      console.log(
        `[ingest paste] companyId: ${companyId}${resolved.created ? ' (new)' : ''}${
          resolved.provisional ? ' (provisional — admin dedup queue)' : ''
        }`,
      );
    } catch (err) {
      console.warn(
        `[ingest paste] resolveCompany failed for "${company}": ${
          err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120)
        } — proceeding without companyId`,
      );
    }

    const job: Job = {
      id,
      title,
      company,
      ...(companyId ? { companyId } : {}),
      vertical,
      ...(subVertical ? { subVertical } : {}),
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
    if (companyId) await addActiveJob(companyId, id);
    console.log(`[ingest paste] Saved job ${id} (${title} @ ${company})`);

    // Tier 1 scrape fire — best-effort, blocks paste flow for visibility.
    // For ITviec only in Phase 02 lite; other sources mint stub-only.
    if (companyId && source === 'itviec' && sourceCompanyUrl) {
      console.log('[ingest paste] Firing Tier 1 scrape...');
      const tier1 = await fireTier1Scrape({
        source,
        sourceCompanyUrl,
        slug: companyId,
        created: false, // paste flow doesn't track resolveCompany.created; let helper re-check
      });
      if (tier1.ok) {
        console.log(`[ingest paste] Tier 1 populated (${tier1.fieldCount}/6 fields)`);
      } else if (tier1.fired) {
        console.warn(`[ingest paste] Tier 1 scrape failed: ${tier1.reason}`);
      } else {
        console.log(`[ingest paste] Tier 1 skipped: ${tier1.skipped}`);
      }
    }
  } finally {
    rl.close();
  }
}

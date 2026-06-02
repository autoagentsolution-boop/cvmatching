// Job Fit & Study aggregated stats reader (v0.3 Phase 4).
// Separated from read-usage.ts to stay under 200 LOC file limit.
// Consumed by admin/usage page to render the "Job Fit & Study" section.
//
// NOTE: Top-10 clicks uses kv.scan (O(N) at 150 jobs — cheap).
// At 2000+ jobs, replace with a sorted-set (ZSET) leaderboard (deferred v0.3b).

import { kv, kvAvailable } from '@/lib/quota/kv-client';
import { microUsdToString } from '@/lib/llm/model-prices';
import { weekMondayYmd } from '@/lib/usage/week-monday-ymd';

export interface JobClickEntry {
  jobId: string;
  count: number;
}

export interface JobFitStats {
  jobRecommend: { costMicroUsd: number; costDisplay: string };
  clicks: { total: number; top10: JobClickEntry[] };
  refresh: { ok: number; expired: number; errors: number; batches: number };
  topDislikedTopics: Array<{ topicId: string; count: number }>;
}

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// P1.4 — Full scan: iterate cursor until 0 to avoid single-page truncation.
// Upstash REST returns [cursor, keys]; cursor "0" signals the final page.
async function scanAll(pattern: string): Promise<string[]> {
  const out: string[] = [];
  let cursor: string | number = 0;
  do {
    const page = await kv.scan(cursor, { match: pattern, count: 100 });
    const nextCursor = page[0] as string | number;
    const batch = page[1] as string[];
    out.push(...(batch ?? []));
    cursor = nextCursor;
  } while (String(cursor) !== '0');
  return out;
}

const EMPTY: JobFitStats = {
  jobRecommend: { costMicroUsd: 0, costDisplay: '$0.00' },
  clicks: { total: 0, top10: [] },
  refresh: { ok: 0, expired: 0, errors: 0, batches: 0 },
  topDislikedTopics: [],
};

/**
 * Read Job Fit stats for a given VN date string (YYYY-MM-DD).
 * Fails open — returns empty on any KV error to avoid crashing the admin page.
 */
export async function getJobFitStats(ymd: string): Promise<JobFitStats> {
  if (!kvAvailable) return EMPTY;

  try {
    // --- Cost for job-recommend bucket ---
    const costRaw = await kv.get<string | number>(`metrics:cost:${ymd}:job-recommend`);
    const costMicroUsd = num(costRaw);

    // --- Refresh stats hash ---
    const refreshRaw = await kv.hgetall<Record<string, string>>(`metrics:refresh:${ymd}`);
    const refresh = {
      ok: num(refreshRaw?.ok),
      expired: num(refreshRaw?.expired),
      errors: num(refreshRaw?.errors),
      batches: num(refreshRaw?.batches),
    };

    // --- Total clicks today ---
    const totalClicksRaw = await kv.get<string | number>(`metrics:click:total:${ymd}`);
    const totalClicks = num(totalClicksRaw);

    // --- Top-10 clicked jobs via key scan ---
    // P1.4 — iterate cursor until 0; single-shot scan truncates at ~50 keys.
    const allClickKeys = await scanAll(`metrics:click:*:${ymd}`);
    const jobClickKeys = allClickKeys.filter(
      (k) => k !== `metrics:click:total:${ymd}`,
    );

    let top10: JobClickEntry[] = [];
    if (jobClickKeys.length > 0) {
      const counts = await kv.mget<(string | number | null)[]>(...jobClickKeys);
      const entries: JobClickEntry[] = jobClickKeys.map((k, i) => ({
        // key shape: metrics:click:<jobId>:<ymd>
        jobId: k.slice('metrics:click:'.length).slice(0, -ymd.length - 1),
        count: num(counts[i]),
      }));
      entries.sort((a, b) => b.count - a.count);
      top10 = entries.slice(0, 10);
    }

    // --- Top-disliked topics this week ---
    // P1.4 — full cursor iteration; P2.2 — shared weekMondayYmd (imported above)
    const weekYmd = weekMondayYmd();
    const dislikeKeys = await scanAll(`dislikes:*:${weekYmd}`);

    let topDislikedTopics: Array<{ topicId: string; count: number }> = [];
    if (dislikeKeys.length > 0) {
      const dCounts = await kv.mget<(string | number | null)[]>(...dislikeKeys);
      const dEntries = dislikeKeys.map((k, i) => ({
        // key shape: dislikes:<topicId>:<weekYmd>
        topicId: k.slice('dislikes:'.length).slice(0, -weekYmd.length - 1),
        count: num(dCounts[i]),
      }));
      dEntries.sort((a, b) => b.count - a.count);
      topDislikedTopics = dEntries.slice(0, 10);
    }

    return {
      jobRecommend: {
        costMicroUsd,
        costDisplay: microUsdToString(costMicroUsd),
      },
      clicks: { total: totalClicks, top10 },
      refresh,
      topDislikedTopics,
    };
  } catch (e) {
    console.warn('[read-job-fit-stats] failed', {
      message: e instanceof Error ? e.message : String(e),
    });
    return EMPTY;
  }
}

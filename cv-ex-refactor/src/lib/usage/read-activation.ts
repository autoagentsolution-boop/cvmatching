// Activation = successful event count per feature, split by anon-shared-key
// vs signed-in. Surfaced on /admin/usage as the "Activation today" tile to
// drive the anon→signup→activation funnel decision pre-pilot-reopen.
//
// Schema (written by track-usage.ts):
//   usage:global:<ymd>:<action>:ok                  — primary total (anon + signed)
//   usage:global:<ymd>:<action>:anon:ok             — shared-key anon subset
//   usage:global:<ymd>:analyze-v2:ok                — JD Matching pseudo-action
//   usage:global:<ymd>:analyze-v2:anon:ok           — JD Matching anon subset
//   usage:global:<ymd>:analyze-v3:ok                — CV-Solo pseudo-action
//   usage:global:<ymd>:analyze-v3:anon:ok           — CV-Solo anon subset
//
// signed-in is derived as (total - anon) — no separate counter written.

import { kv, kvAvailable } from '@/lib/quota/kv-client';

// Pseudo-actions (analyze-v2/v3) included so the tile can show JD Matching vs
// CV-Solo as distinct rows under the same `analyze` umbrella.
export const ACTIVATION_ACTIONS = [
  'analyze',
  'analyze-v2',
  'analyze-v3',
  'generate-cv',
  'generate-cover-letter',
  'career-path',
  'job-recommend',
] as const;

export type ActivationAction = (typeof ACTIVATION_ACTIONS)[number];

export interface ActivationFeatureCounts {
  total: number;
  anon: number;
  signedIn: number;
}

export interface ActivationDailyRow {
  date: string;
  features: Record<ActivationAction, ActivationFeatureCounts>;
}

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function emptyFeature(): ActivationFeatureCounts {
  return { total: 0, anon: 0, signedIn: 0 };
}

function emptyRow(ymd: string): ActivationDailyRow {
  const features = Object.fromEntries(
    ACTIVATION_ACTIONS.map((a) => [a, emptyFeature()]),
  ) as Record<ActivationAction, ActivationFeatureCounts>;
  return { date: ymd, features };
}

/**
 * Fetch one day's per-feature activation counts. Reads only `:ok` counters
 * (activation = successful event). All keys MGET'd in one round-trip.
 */
export async function readActivationDay(ymd: string): Promise<ActivationDailyRow> {
  if (!kvAvailable) return emptyRow(ymd);

  // For each action: total (`<action>:ok`) + anon (`<action>:anon:ok`).
  const keys: string[] = [];
  for (const action of ACTIVATION_ACTIONS) {
    keys.push(`usage:global:${ymd}:${action}:ok`);
    keys.push(`usage:global:${ymd}:${action}:anon:ok`);
  }

  let values: (string | number | null)[];
  try {
    values = await kv.mget<(string | number | null)[]>(...keys);
  } catch (e) {
    console.warn('[read-activation] kv_mget_failed', {
      ymd,
      message: e instanceof Error ? e.message : String(e),
    });
    return emptyRow(ymd);
  }

  const row = emptyRow(ymd);
  ACTIVATION_ACTIONS.forEach((action, i) => {
    const total = num(values[i * 2]);
    const anon = num(values[i * 2 + 1]);
    row.features[action] = {
      total,
      anon,
      // Anon counter started writing today; historical anon calls were never
      // tagged. Clamp at 0 so we don't show negative signed-in numbers.
      signedIn: Math.max(0, total - anon),
    };
  });
  return row;
}

/**
 * Multi-day read for trend display. `days` rows ending at `endYmd` inclusive.
 */
export async function readActivationRange(
  endYmd: string,
  days: number,
): Promise<ActivationDailyRow[]> {
  if (!kvAvailable || days <= 0) return [];

  const end = new Date(`${endYmd}T00:00:00Z`);
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
        d.getUTCDate(),
      ).padStart(2, '0')}`,
    );
  }
  return Promise.all(dates.map(readActivationDay));
}

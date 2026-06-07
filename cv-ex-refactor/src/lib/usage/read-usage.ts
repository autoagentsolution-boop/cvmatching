import { kv, kvAvailable } from '@/lib/quota/kv-client';
import type { UsageAction } from './track-usage';

const ACTIONS: UsageAction[] = ['analyze', 'generate-cv', 'extract-must-haves'];

export interface UserUsageRow {
  userId: string;
  analyze: number;
  generateCv: number;
  extractMustHaves: number;
  byok: number;
  shared: number;
  charVolume: number;
  tokens: number;
  costMicroUsd: number;
}

export interface DailyGlobalRow {
  date: string;
  analyzeOk: number;
  analyzeError: number;
  generateCvOk: number;
  generateCvError: number;
  extractMustHavesOk: number;
  extractMustHavesError: number;
  // Tracked via logLlmCall → trackUsage but previously not exposed. Surface for
  // funnel view (Q4) so admin can see drop-off across all action types.
  jobRecommendOk: number;
  jobRecommendError: number;
  careerPathOk: number;
  careerPathError: number;
  careerPathSuggestOk: number;
  careerPathSuggestError: number;
  generateCoverLetterOk: number;
  generateCoverLetterError: number;
  charVolume: number;
  tokens: number;
  sharedCalls: number;
  sharedCostMicroUsd: number;
}

export interface UsageSnapshot {
  month: string;
  users: UserUsageRow[];
  byokAnon: { analyze: number; generateCv: number; extractMustHaves: number };
  daily: DailyGlobalRow[];
}

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function ymdOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

async function readUserRow(userId: string, ym: string): Promise<UserUsageRow> {
  const keys = [
    `usage:user:${userId}:${ym}:analyze`,
    `usage:user:${userId}:${ym}:generate-cv`,
    `usage:user:${userId}:${ym}:extract-must-haves`,
    `usage:user:${userId}:${ym}:byok`,
    `usage:user:${userId}:${ym}:shared`,
    `usage:user:${userId}:${ym}:analyze:chars`,
    `usage:user:${userId}:${ym}:generate-cv:chars`,
    `usage:user:${userId}:${ym}:extract-must-haves:chars`,
    `usage:user:${userId}:${ym}:analyze:tokens`,
    `usage:user:${userId}:${ym}:generate-cv:tokens`,
    `usage:user:${userId}:${ym}:extract-must-haves:tokens`,
    `usage:user:${userId}:${ym}:analyze:cost-muusd`,
    `usage:user:${userId}:${ym}:generate-cv:cost-muusd`,
    `usage:user:${userId}:${ym}:extract-must-haves:cost-muusd`,
  ];
  const values = await kv.mget<(string | number | null)[]>(...keys);
  const v = values.map(num);
  return {
    userId,
    analyze: v[0] ?? 0,
    generateCv: v[1] ?? 0,
    extractMustHaves: v[2] ?? 0,
    byok: v[3] ?? 0,
    shared: v[4] ?? 0,
    charVolume: (v[5] ?? 0) + (v[6] ?? 0) + (v[7] ?? 0),
    tokens: (v[8] ?? 0) + (v[9] ?? 0) + (v[10] ?? 0),
    costMicroUsd: (v[11] ?? 0) + (v[12] ?? 0) + (v[13] ?? 0),
  };
}

async function readByokAnon(ym: string) {
  const keys = ACTIONS.map((a) => `usage:byok-anon:${ym}:${a}`);
  const values = await kv.mget<(string | number | null)[]>(...keys);
  const v = values.map(num);
  return {
    analyze: v[0] ?? 0,
    generateCv: v[1] ?? 0,
    extractMustHaves: v[2] ?? 0,
  };
}

async function readDailyRow(ymd: string): Promise<DailyGlobalRow> {
  const keys = [
    `usage:global:${ymd}:analyze:ok`,
    `usage:global:${ymd}:analyze:error`,
    `usage:global:${ymd}:generate-cv:ok`,
    `usage:global:${ymd}:generate-cv:error`,
    `usage:global:${ymd}:extract-must-haves:ok`,
    `usage:global:${ymd}:extract-must-haves:error`,
    `usage:global:${ymd}:analyze:chars`,
    `usage:global:${ymd}:generate-cv:chars`,
    `usage:global:${ymd}:extract-must-haves:chars`,
    `usage:global:${ymd}:analyze:tokens`,
    `usage:global:${ymd}:generate-cv:tokens`,
    `usage:global:${ymd}:extract-must-haves:tokens`,
    `usage:global:${ymd}:shared:calls`,
    `usage:global:${ymd}:shared:cost-muusd`,
    `usage:global:${ymd}:job-recommend:ok`,
    `usage:global:${ymd}:job-recommend:error`,
    `usage:global:${ymd}:career-path:ok`,
    `usage:global:${ymd}:career-path:error`,
    `usage:global:${ymd}:career-path-suggest:ok`,
    `usage:global:${ymd}:career-path-suggest:error`,
    `usage:global:${ymd}:generate-cover-letter:ok`,
    `usage:global:${ymd}:generate-cover-letter:error`,
  ];
  const values = await kv.mget<(string | number | null)[]>(...keys);
  const v = values.map(num);
  return {
    date: ymd,
    analyzeOk: v[0] ?? 0,
    analyzeError: v[1] ?? 0,
    generateCvOk: v[2] ?? 0,
    generateCvError: v[3] ?? 0,
    extractMustHavesOk: v[4] ?? 0,
    extractMustHavesError: v[5] ?? 0,
    charVolume: (v[6] ?? 0) + (v[7] ?? 0) + (v[8] ?? 0),
    tokens: (v[9] ?? 0) + (v[10] ?? 0) + (v[11] ?? 0),
    sharedCalls: v[12] ?? 0,
    sharedCostMicroUsd: v[13] ?? 0,
    jobRecommendOk: v[14] ?? 0,
    jobRecommendError: v[15] ?? 0,
    careerPathOk: v[16] ?? 0,
    careerPathError: v[17] ?? 0,
    careerPathSuggestOk: v[18] ?? 0,
    careerPathSuggestError: v[19] ?? 0,
    generateCoverLetterOk: v[20] ?? 0,
    generateCoverLetterError: v[21] ?? 0,
  };
}

export async function getUsageSnapshot(ym: string, dailyDays = 30): Promise<UsageSnapshot> {
  if (!kvAvailable) {
    return {
      month: ym,
      users: [],
      byokAnon: { analyze: 0, generateCv: 0, extractMustHaves: 0 },
      daily: [],
    };
  }

  // Pre-compute date list (no I/O) so the daily fetch can fan out
  // alongside the user roster and byok-anon fetch instead of waiting
  // for them. Was 3 sequential KV rounds; now 2 (smembers → fan-out).
  const userIds = (await kv.smembers(`usage:users:${ym}`)) ?? [];

  const now = new Date();
  const dates: string[] = [];
  for (let i = dailyDays - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(ymdOf(d));
  }

  const [userRowsRaw, byokAnon, daily] = await Promise.all([
    Promise.all(userIds.map((uid) => readUserRow(String(uid), ym))),
    readByokAnon(ym),
    Promise.all(dates.map(readDailyRow)),
  ]);

  const userRows = [...userRowsRaw].sort(
    (a, b) => b.costMicroUsd - a.costMicroUsd || b.analyze + b.generateCv - (a.analyze + a.generateCv),
  );

  return { month: ym, users: userRows, byokAnon, daily };
}

export function currentYm(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}


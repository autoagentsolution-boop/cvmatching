import { kv, kvAvailable } from './kv-client';
import { vnDateString, secondsUntilVnMidnight } from './vn-date';
import { ANON_QUOTA_LIMITS, QUOTA_LIMITS, type QuotaKind } from './consume-quota';

export interface KindStatus {
  used: number;
  limit: number;
  remaining: number;
}

export interface QuotaStatus {
  enforced: boolean;
  resetInSec: number;
  kinds: Record<QuotaKind, KindStatus>;
}

const KIND_LIST: QuotaKind[] = [
  'analyze',
  'generate-cv',
  'generate-cover-letter',
  'career-path',
  'job-recommend',
];

function defaultKindStatus(limit: number): KindStatus {
  return { used: 0, limit, remaining: limit };
}

async function readKinds(
  keyFor: (kind: QuotaKind) => string,
  limits: Record<QuotaKind, number>,
): Promise<Record<QuotaKind, KindStatus>> {
  const kinds = {} as Record<QuotaKind, KindStatus>;
  await Promise.all(
    KIND_LIST.map(async (kind) => {
      const limit = limits[kind];
      try {
        const raw = await kv.get<number>(keyFor(kind));
        const used = typeof raw === 'number' ? raw : 0;
        kinds[kind] = { used, limit, remaining: Math.max(0, limit - used) };
      } catch (e) {
        console.warn('[quota] kv_get_failed', {
          kind,
          message: e instanceof Error ? e.message : String(e),
        });
        kinds[kind] = defaultKindStatus(limit);
      }
    }),
  );
  return kinds;
}

function emptyStatus(limits: Record<QuotaKind, number>): QuotaStatus {
  return {
    enforced: false,
    resetInSec: secondsUntilVnMidnight(),
    kinds: {
      analyze: defaultKindStatus(limits.analyze),
      'generate-cv': defaultKindStatus(limits['generate-cv']),
      'generate-cover-letter': defaultKindStatus(limits['generate-cover-letter']),
      'career-path': defaultKindStatus(limits['career-path']),
      'job-recommend': defaultKindStatus(limits['job-recommend']),
    },
  };
}

export async function getQuotaStatus(userId: string): Promise<QuotaStatus> {
  if (!kvAvailable) return emptyStatus(QUOTA_LIMITS);
  const day = vnDateString();
  const kinds = await readKinds((k) => `q:${userId}:${day}:${k}`, QUOTA_LIMITS);
  return { enforced: true, resetInSec: secondsUntilVnMidnight(), kinds };
}

export async function getAnonQuotaStatus(ip: string): Promise<QuotaStatus> {
  if (!kvAvailable) return emptyStatus(ANON_QUOTA_LIMITS);
  const day = vnDateString();
  const kinds = await readKinds((k) => `q:anon:${ip}:${day}:${k}`, ANON_QUOTA_LIMITS);
  return { enforced: true, resetInSec: secondsUntilVnMidnight(), kinds };
}

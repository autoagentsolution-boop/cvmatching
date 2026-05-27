import { kv, kvAvailable } from './kv-client';
import { vnDateString, secondsUntilVnMidnight } from './vn-date';
import { QUOTA_LIMITS, type QuotaKind } from './consume-quota';

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

const KIND_LIST: QuotaKind[] = ['analyze', 'generate-cv'];

function defaultKindStatus(kind: QuotaKind): KindStatus {
  const limit = QUOTA_LIMITS[kind];
  return { used: 0, limit, remaining: limit };
}

export async function getQuotaStatus(userId: string): Promise<QuotaStatus> {
  if (!kvAvailable) {
    return {
      enforced: false,
      resetInSec: secondsUntilVnMidnight(),
      kinds: {
        analyze: defaultKindStatus('analyze'),
        'generate-cv': defaultKindStatus('generate-cv'),
      },
    };
  }

  const day = vnDateString();
  const kinds = {} as Record<QuotaKind, KindStatus>;

  await Promise.all(
    KIND_LIST.map(async (kind) => {
      const limit = QUOTA_LIMITS[kind];
      try {
        const raw = await kv.get<number>(`q:${userId}:${day}:${kind}`);
        const used = typeof raw === 'number' ? raw : 0;
        kinds[kind] = { used, limit, remaining: Math.max(0, limit - used) };
      } catch (e) {
        console.warn('[quota] kv_get_failed', {
          kind,
          message: e instanceof Error ? e.message : String(e),
        });
        kinds[kind] = defaultKindStatus(kind);
      }
    }),
  );

  return { enforced: true, resetInSec: secondsUntilVnMidnight(), kinds };
}

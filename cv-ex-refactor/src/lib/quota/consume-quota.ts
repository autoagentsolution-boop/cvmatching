import { kv, kvAvailable } from './kv-client';
import { vnDateString, secondsUntilVnMidnight } from './vn-date';

export const QUOTA_LIMITS = {
  analyze: 5,
  'generate-cv': 2,
} as const;

export type QuotaKind = keyof typeof QUOTA_LIMITS;

/**
 * Action type accepted by the resolver layer. Only QuotaKind actions are
 * counted; helpers like `extract-must-haves` pass through with no debit.
 */
export type QuotaAction = QuotaKind | 'extract-must-haves';

export interface QuotaResult {
  ok: boolean;
  remaining: number | null;
  used?: number;
  limit?: number;
  resetInSec?: number;
  reason?: string;
}

function isQuotaKind(action: QuotaAction): action is QuotaKind {
  return action === 'analyze' || action === 'generate-cv';
}

function quotaKey(userId: string, kind: QuotaKind, day: string): string {
  return `q:${userId}:${day}:${kind}`;
}

export async function consumeQuotaForUser(
  userId: string,
  action: QuotaAction,
): Promise<QuotaResult> {
  if (!isQuotaKind(action)) {
    return { ok: true, remaining: null };
  }
  if (!kvAvailable) {
    return { ok: true, remaining: null };
  }

  const limit = QUOTA_LIMITS[action];
  const day = vnDateString();
  const key = quotaKey(userId, action, day);

  try {
    const used = await kv.incr(key);
    if (used === 1) {
      await kv.expire(key, secondsUntilVnMidnight() + 60);
    }
    if (used > limit) {
      return {
        ok: false,
        remaining: 0,
        used: used - 1,
        limit,
        resetInSec: secondsUntilVnMidnight(),
        reason: `Hết quota hôm nay (${limit}/${limit}). Reset 00:00 giờ VN.`,
      };
    }
    return { ok: true, remaining: limit - used, used, limit };
  } catch (e) {
    console.warn('[quota] kv_incr_failed', {
      action,
      message: e instanceof Error ? e.message : String(e),
    });
    return { ok: true, remaining: null };
  }
}

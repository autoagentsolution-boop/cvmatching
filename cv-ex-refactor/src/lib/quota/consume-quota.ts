import { kv, kvAvailable } from './kv-client';
import { vnDateString, secondsUntilVnMidnight } from './vn-date';

export const QUOTA_LIMITS = {
  analyze: 5,
  'generate-cv': 2,
  'career-path': 3,
} as const;

// Anonymous (no login) pilot users share a stricter daily limit per IP, so a
// single shared-key visitor cannot drain the budget. Adjust as needed.
export const ANON_QUOTA_LIMITS = {
  analyze: 3,
  'generate-cv': 1,
  'career-path': 2,
} as const;

export type QuotaKind = keyof typeof QUOTA_LIMITS;

/**
 * Action type accepted by the resolver layer. Only QuotaKind actions are
 * counted; helpers like `extract-must-haves` and `career-path-suggest`
 * pass through with no debit (rate-limited at the IP level instead).
 */
export type QuotaAction = QuotaKind | 'extract-must-haves' | 'career-path-suggest';

export interface QuotaResult {
  ok: boolean;
  remaining: number | null;
  used?: number;
  limit?: number;
  resetInSec?: number;
  reason?: string;
}

function isQuotaKind(action: QuotaAction): action is QuotaKind {
  return action === 'analyze' || action === 'generate-cv' || action === 'career-path';
}

function userQuotaKey(userId: string, kind: QuotaKind, day: string): string {
  return `q:${userId}:${day}:${kind}`;
}

function anonQuotaKey(ip: string, kind: QuotaKind, day: string): string {
  return `q:anon:${ip}:${day}:${kind}`;
}

async function consume(
  key: string,
  limit: number,
  action: QuotaKind,
): Promise<QuotaResult> {
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
        reason: `Hết quota hôm nay (${limit}/${limit}). Reset 00:00 giờ VN, hoặc dùng API key riêng của bạn (BYOK) trong Settings.`,
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

export async function consumeQuotaForUser(
  userId: string,
  action: QuotaAction,
): Promise<QuotaResult> {
  if (!isQuotaKind(action)) return { ok: true, remaining: null };
  if (!kvAvailable) return { ok: true, remaining: null };
  return consume(userQuotaKey(userId, action, vnDateString()), QUOTA_LIMITS[action], action);
}

export async function consumeQuotaForAnon(
  ip: string,
  action: QuotaAction,
): Promise<QuotaResult> {
  if (!isQuotaKind(action)) return { ok: true, remaining: null };
  if (!kvAvailable) return { ok: true, remaining: null };
  return consume(anonQuotaKey(ip, action, vnDateString()), ANON_QUOTA_LIMITS[action], action);
}

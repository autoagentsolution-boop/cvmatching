import { kv, kvAvailable } from '@/lib/quota/kv-client';
import { vnDateString, secondsUntilVnMidnight } from '@/lib/quota/vn-date';

/**
 * Lightweight in-app visit tracking. Two counters:
 *  - `visits:total`     — lifetime, no TTL
 *  - `visits:d:<YYYY-MM-DD>` — today only (VN day, auto-expires at midnight)
 *
 * Unique-visitor dedup uses an IP marker key with 1-day TTL to avoid
 * inflating numbers when a single user reloads. Privacy: IP never stored
 * long-term, only as a transient dedup key.
 */

const TOTAL_KEY = 'visits:total';
const TOTAL_UNIQUE_KEY = 'visits:total:unique';

function dailyKey(day: string): string {
  return `visits:d:${day}`;
}
function dailyUniqueKey(day: string): string {
  return `visits:d:${day}:unique`;
}
/** Redis SET storing IPs seen today — SADD tells us if it's new. */
function dailyIpSetKey(day: string): string {
  return `visits:ipset:${day}`;
}

export async function recordVisit(ip: string): Promise<void> {
  if (!kvAvailable) return;
  const day = vnDateString();
  try {
    await Promise.all([
      kv.incr(TOTAL_KEY),
      kv.incr(dailyKey(day)).then((n) => (n === 1 ? kv.expire(dailyKey(day), secondsUntilVnMidnight() + 60) : null)),
    ]);

    // Unique dedup via Redis SET. SADD returns the count of NEW members —
    // 1 if this IP wasn't already in today's set, 0 if it was. Reliable
    // across @vercel/kv (previous SETNX approach returned values we
    // couldn't trust for the conditional).
    const ipSetKey = dailyIpSetKey(day);
    const added = await kv.sadd(ipSetKey, ip);
    if (added && added > 0) {
      await Promise.all([
        kv.incr(TOTAL_UNIQUE_KEY),
        kv.incr(dailyUniqueKey(day)).then((n) => (n === 1 ? kv.expire(dailyUniqueKey(day), secondsUntilVnMidnight() + 60) : null)),
        // Re-arm the IP set's TTL on first add of the day.
        added === 1 ? kv.expire(ipSetKey, secondsUntilVnMidnight() + 60) : null,
      ]);
    }
  } catch {
    // Best-effort — never block a request on analytics.
  }
}

export interface VisitStats {
  total: number;
  totalUnique: number;
  today: number;
  todayUnique: number;
}

export async function readVisitStats(): Promise<VisitStats> {
  if (!kvAvailable) {
    return { total: 0, totalUnique: 0, today: 0, todayUnique: 0 };
  }
  const day = vnDateString();
  try {
    const [total, totalUnique, today, todayUnique] = await kv.mget<(number | string | null)[]>(
      TOTAL_KEY,
      TOTAL_UNIQUE_KEY,
      dailyKey(day),
      dailyUniqueKey(day),
    );
    return {
      total: Number(total ?? 0),
      totalUnique: Number(totalUnique ?? 0),
      today: Number(today ?? 0),
      todayUnique: Number(todayUnique ?? 0),
    };
  } catch {
    return { total: 0, totalUnique: 0, today: 0, todayUnique: 0 };
  }
}

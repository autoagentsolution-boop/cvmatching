import { kv, kvAvailable } from '@/lib/quota/kv-client';
import { vnDateString } from '@/lib/quota/vn-date';

/**
 * In-app visit tracking. Counters:
 *  - `visits:total`              — lifetime pageview count, no TTL
 *  - `visits:total:unique`       — lifetime unique-IP count, no TTL
 *  - `visits:d:<YYYY-MM-DD>`     — daily pageview (90-day TTL for rolling history)
 *  - `visits:d:<ymd>:unique`     — daily unique-IP
 *  - `visits:d:<ymd>:authed`     — daily pageviews with valid NextAuth JWT (Q3 funnel)
 *  - `visits:ipset:<ymd>`        — Redis SET of IPs seen that day (dedup, same TTL)
 *
 * Privacy: IP only stored as transient dedup key, never long-term.
 * TTL: 90 days for rolling admin/usage history.
 */

const TOTAL_KEY = 'visits:total';
const TOTAL_UNIQUE_KEY = 'visits:total:unique';
const DAILY_TTL_SECONDS = 90 * 24 * 3600;

function dailyKey(day: string): string {
  return `visits:d:${day}`;
}
function dailyUniqueKey(day: string): string {
  return `visits:d:${day}:unique`;
}
function dailyAuthedKey(day: string): string {
  return `visits:d:${day}:authed`;
}
function dailyIpSetKey(day: string): string {
  return `visits:ipset:${day}`;
}

export async function recordVisit(ip: string, isAuthed: boolean = false): Promise<void> {
  if (!kvAvailable) return;
  const day = vnDateString();
  try {
    const ops: Promise<unknown>[] = [
      kv.incr(TOTAL_KEY),
      kv.incr(dailyKey(day)).then((n) => (n === 1 ? kv.expire(dailyKey(day), DAILY_TTL_SECONDS) : null)),
    ];
    if (isAuthed) {
      ops.push(
        kv.incr(dailyAuthedKey(day)).then((n) =>
          n === 1 ? kv.expire(dailyAuthedKey(day), DAILY_TTL_SECONDS) : null,
        ),
      );
    }
    await Promise.all(ops);

    const ipSetKey = dailyIpSetKey(day);
    const added = await kv.sadd(ipSetKey, ip);
    if (added && added > 0) {
      await Promise.all([
        kv.incr(TOTAL_UNIQUE_KEY),
        kv.incr(dailyUniqueKey(day)).then((n) =>
          n === 1 ? kv.expire(dailyUniqueKey(day), DAILY_TTL_SECONDS) : null,
        ),
        added === 1 ? kv.expire(ipSetKey, DAILY_TTL_SECONDS) : null,
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
  todayAuthed: number;
}

export async function readVisitStats(): Promise<VisitStats> {
  if (!kvAvailable) {
    return { total: 0, totalUnique: 0, today: 0, todayUnique: 0, todayAuthed: 0 };
  }
  const day = vnDateString();
  try {
    const [total, totalUnique, today, todayUnique, todayAuthed] = await kv.mget<(number | string | null)[]>(
      TOTAL_KEY,
      TOTAL_UNIQUE_KEY,
      dailyKey(day),
      dailyUniqueKey(day),
      dailyAuthedKey(day),
    );
    return {
      total: Number(total ?? 0),
      totalUnique: Number(totalUnique ?? 0),
      today: Number(today ?? 0),
      todayUnique: Number(todayUnique ?? 0),
      todayAuthed: Number(todayAuthed ?? 0),
    };
  } catch {
    return { total: 0, totalUnique: 0, today: 0, todayUnique: 0, todayAuthed: 0 };
  }
}

export interface DailyVisitRow {
  date: string;
  pageviews: number;
  unique: number;
  authed: number;
}

/**
 * Read rolling N-day visit history for admin/usage dashboard.
 * Reads pageview + unique + authed for each day. Persisted with 90-day TTL.
 */
export async function readDailyVisits(days: number): Promise<DailyVisitRow[]> {
  if (!kvAvailable) return [];
  const now = new Date();
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
    );
  }
  try {
    const keys: string[] = [];
    for (const d of dates) {
      keys.push(dailyKey(d), dailyUniqueKey(d), dailyAuthedKey(d));
    }
    const values = await kv.mget<(number | string | null)[]>(...keys);
    return dates.map((date, i) => ({
      date,
      pageviews: Number(values[i * 3] ?? 0),
      unique: Number(values[i * 3 + 1] ?? 0),
      authed: Number(values[i * 3 + 2] ?? 0),
    }));
  } catch {
    return dates.map((date) => ({ date, pageviews: 0, unique: 0, authed: 0 }));
  }
}

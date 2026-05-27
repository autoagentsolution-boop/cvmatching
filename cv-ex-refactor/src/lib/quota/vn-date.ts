const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** YYYY-MM-DD in Asia/Bangkok (UTC+7), regardless of server clock zone. */
export function vnDateString(now: Date = new Date()): string {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  return vn.toISOString().slice(0, 10);
}

/** Seconds remaining until next 00:00 in VN time. Used for KV TTL alignment. */
export function secondsUntilVnMidnight(now: Date = new Date()): number {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  const nextVnMidnightUtc = Date.UTC(
    vn.getUTCFullYear(),
    vn.getUTCMonth(),
    vn.getUTCDate() + 1,
  );
  const diffMs = nextVnMidnightUtc - vn.getTime();
  return Math.ceil(diffMs / 1000);
}

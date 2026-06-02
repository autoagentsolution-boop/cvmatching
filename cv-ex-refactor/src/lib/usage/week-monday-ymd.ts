// Shared week-start helper — Monday of the current UTC week, formatted YYYY-MM-DD.
// Single source of truth: both the feedback writer (topics/feedback/route.ts)
// and the stats reader (read-job-fit-stats.ts) must use this to keep key shapes aligned.
// Convention: UTC only (Upstash stores keys in UTC).

export function weekMondayYmd(date: Date = new Date()): string {
  const d = new Date(date); // copy — avoid mutating caller's date
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // rewind to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

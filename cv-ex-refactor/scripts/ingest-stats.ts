// Print active/expired job counts broken down by vertical, seniority,
// and source — straight from Postgres.
//
// Switched to PG in pre-2K hardening (2026-06-07). Previously read from
// KV via listActiveIds + per-job hgetall — but ingest writes to PG since
// Phase 4 cutover. KV count is frozen at 171 (the migration baseline)
// and not useful as a refresh-progress signal.

import { sql } from 'drizzle-orm';
import { getDb } from '../src/db/index.js';
import { jobs } from '../src/db/schema.js';

type Row = {
  vertical?: string;
  seniority?: string;
  source?: string;
  active?: string;
  [key: string]: unknown;
};

export async function run(): Promise<void> {
  const db = getDb();

  const [verticalRows, seniorityRows, sourceRows, totalRow] = await Promise.all([
    db.execute<Row>(sql`
      SELECT vertical, COUNT(*) AS active
      FROM ${jobs} WHERE active = true
      GROUP BY vertical ORDER BY active DESC
    `),
    db.execute<Row>(sql`
      SELECT seniority, COUNT(*) AS active
      FROM ${jobs} WHERE active = true
      GROUP BY seniority ORDER BY active DESC
    `),
    db.execute<Row>(sql`
      SELECT source, COUNT(*) AS active
      FROM ${jobs} WHERE active = true
      GROUP BY source ORDER BY active DESC
    `),
    db.execute<{ active: string; inactive: string }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE active = true) AS active,
        COUNT(*) FILTER (WHERE active = false) AS inactive
      FROM ${jobs}
    `),
  ]);

  // Drizzle's execute() returns rows directly on Neon http driver but as
  // { rows } on node-postgres. Normalize.
  const asRows = <T,>(r: { rows?: T[] } | T[]): T[] =>
    Array.isArray(r) ? r : (r.rows ?? []);

  const totals = asRows(totalRow)[0] ?? { active: '0', inactive: '0' };

  const byVertical: Record<string, number> = {};
  for (const r of asRows(verticalRows)) {
    if (r.vertical) byVertical[r.vertical] = Number(r.active);
  }

  const bySeniority: Record<string, number> = {};
  for (const r of asRows(seniorityRows)) {
    if (r.seniority) bySeniority[r.seniority] = Number(r.active);
  }

  const bySource: Record<string, number> = {};
  for (const r of asRows(sourceRows)) {
    if (r.source) bySource[r.source] = Number(r.active);
  }

  const stats = {
    active: Number(totals.active),
    expired: Number(totals.inactive),
    byVertical,
    bySeniority,
    bySource,
  };

  console.log(JSON.stringify(stats, null, 2));
}

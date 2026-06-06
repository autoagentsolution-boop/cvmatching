// Drizzle + Neon HTTP client singleton.
//
// Uses @neondatabase/serverless HTTP path — one fetch per query, no connection
// pooling needed at the application layer (Vercel Function instance = one
// process; pgbouncer handles pooling at Neon edge). Cold start <100ms.
//
// For multi-statement transactions (ingest batches, migrations) use the
// WebSocket path via `import { Pool } from '@neondatabase/serverless'`. Most
// hot-path reads (recommend, dedup, user plan lookup) are single-stmt and
// should go through `db.select()` / `db.insert()` over this HTTP client.

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

type Db = ReturnType<typeof buildDb>;

function buildDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL missing. Provision Neon via Vercel Marketplace, then copy connection string from Neon Console → Connect into .env.local (sensitive vars are masked by `vercel env pull`).',
    );
  }
  return drizzle(neon(url), { schema });
}

let cached: Db | null = null;

/**
 * Lazy-initialized Drizzle client. Call from server-only code (routes, server
 * components, scripts). Throws if `DATABASE_URL` is unset — fail-loud so we
 * never silently fall back to KV-source-of-truth after the Phase 4 cutover.
 */
export function getDb(): Db {
  if (!cached) cached = buildDb();
  return cached;
}

// Re-export schema for convenience: `import { getDb, jobs, users } from '@/db'`.
export * from './schema';

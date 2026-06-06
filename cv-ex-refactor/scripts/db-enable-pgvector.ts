// One-off bootstrap: `CREATE EXTENSION IF NOT EXISTS vector` on the Neon DB.
//
// Run BEFORE the first `pnpm db:migrate` — drizzle-kit's generated migration
// references `vector(768)` columns, which fail if the extension isn't present.
//
// Uses DATABASE_URL_UNPOOLED because CREATE EXTENSION is DDL and pgbouncer
// transaction-mode (the pooled URL) can't reliably reuse a single connection
// across the DDL statement.

import { neon } from '@neondatabase/serverless';

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) {
    console.error(
      '[db-enable-pgvector] DATABASE_URL_UNPOOLED missing. Copy the Direct connection string from Neon Console → Connect tab into .env.local.',
    );
    process.exit(1);
  }

  const sql = neon(url);
  console.log('[db-enable-pgvector] connecting to Neon...');

  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  const rows = await sql`SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'`;
  if (rows.length === 0) {
    console.error('[db-enable-pgvector] vector extension NOT installed — Neon may be missing pgvector support on this plan');
    process.exit(1);
  }
  console.log(`[db-enable-pgvector] vector extension installed: v${rows[0]!.extversion}`);
}

main().catch((err) => {
  console.error('[db-enable-pgvector] FATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});

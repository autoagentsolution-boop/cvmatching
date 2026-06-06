// One-shot diagnostic: list all indexes on `jobs` table to confirm HNSW
// landed alongside the b-tree partial index. Throw-away after Phase 1 ships.

import { neon } from '@neondatabase/serverless';

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) {
    console.error('[db-verify-indexes] DATABASE_URL_UNPOOLED missing');
    process.exit(1);
  }
  const sql = neon(url);

  const rows = await sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'jobs'
    ORDER BY indexname
  `;
  console.log(`[db-verify-indexes] ${rows.length} indexes on jobs:`);
  for (const r of rows) {
    console.log(`  - ${r.indexname}`);
    console.log(`      ${r.indexdef}`);
  }

  const hnsw = rows.find((r) => r.indexname === 'jobs_embedding_hnsw');
  if (!hnsw) {
    console.error('[db-verify-indexes] FAIL: jobs_embedding_hnsw missing');
    process.exit(1);
  }
  if (!String(hnsw.indexdef).includes('hnsw')) {
    console.error('[db-verify-indexes] FAIL: jobs_embedding_hnsw is not HNSW type');
    process.exit(1);
  }
  console.log('[db-verify-indexes] PASS — HNSW index present');
}

main().catch((e) => {
  console.error('[db-verify-indexes] FATAL:', e instanceof Error ? e.stack : e);
  process.exit(1);
});

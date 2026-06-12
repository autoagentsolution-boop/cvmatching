// One-off verification: confirm interview_sessions + applied_jobs tables
// + 4 indexes + generated role_title_hash column exist in the connected DB.
//
// Run: pnpm tsx scripts/verify-interview-schema.ts
//
// Intentionally not committed — see CLAUDE.md, scripts that probe prod state
// stay local. (Actually goes into the repo because operator may want to re-run
// after future migrations — keeping it tracked is fine.)

import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error('DATABASE_URL_UNPOOLED missing');

const sql = neon(url);

async function main() {
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('applied_jobs', 'interview_sessions')
    ORDER BY table_name
  ` as unknown as Array<{ table_name: string }>;
  console.log('tables:', tables.map(r => r.table_name));

  const idx = await sql`
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND tablename IN ('applied_jobs','interview_sessions')
    ORDER BY indexname
  ` as unknown as Array<{ indexname: string }>;
  console.log('indexes:', idx.map(r => r.indexname));

  const generatedCol = await sql`
    SELECT column_name, is_generated, generation_expression
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='interview_sessions' AND column_name='role_title_hash'
  ` as unknown as Array<{ column_name: string; is_generated: string; generation_expression: string }>;
  console.log('role_title_hash:', generatedCol[0]);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

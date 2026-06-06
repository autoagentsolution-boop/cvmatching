// Drizzle Kit config for Neon Postgres. The `out` directory holds
// version-controlled migration SQL files. Uses the UNPOOLED URL because
// pgbouncer transaction-mode (the pooled URL) does not support DDL across
// reused connections — Drizzle Kit's introspect + migrate need a direct conn.
//
// Run with:
//   pnpm db:generate   — diff schema.ts vs migrations/ and emit a new SQL file
//   pnpm db:migrate    — apply pending migrations against $DATABASE_URL_UNPOOLED
//   pnpm db:push       — dev-only: sync schema directly without a migration file
//   pnpm db:studio     — local Drizzle Studio UI on http://localhost:4983

// Load .env.local explicitly — `dotenv/config` defaults to `.env`, which we
// don't use. `.env.local` is where `vercel env pull` writes (modulo masked
// Sensitive values; DATABASE_URL_UNPOOLED is pasted manually from Neon Console).
import { config } from 'dotenv';
config({ path: '.env.local' });

import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  throw new Error(
    'DATABASE_URL_UNPOOLED missing. Either run via `pnpm db:generate` (which loads .env.local through tsx), or set it in your shell. Get the value from Neon Console → Connect → Direct connection.',
  );
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  // Stop drizzle from including system schemas in introspection.
  schemaFilter: ['public'],
});

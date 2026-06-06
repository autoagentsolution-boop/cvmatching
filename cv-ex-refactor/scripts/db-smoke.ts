// Round-trip smoke: INSERT → SELECT → DELETE a synthetic user row.
//
// Verifies (1) DATABASE_URL pooled connection works, (2) Drizzle client
// initializes, (3) the users table exists with the expected shape, (4) cleanup
// succeeds so we leave no test data behind. Run after `pnpm db:migrate`.
//
//   pnpm db:smoke
//
// Exits 0 on full round-trip success, non-zero otherwise. Stdout-friendly so
// it can run in CI without parsing JSON.

import { eq } from 'drizzle-orm';
import { getDb, users } from '../src/db';

const TEST_ID = `smoke-${Date.now()}`;
const TEST_EMAIL = `smoke+${Date.now()}@resume-refactor.local`;

async function main() {
  const db = getDb();
  console.log(`[db-smoke] inserting test user id=${TEST_ID}`);

  await db.insert(users).values({ id: TEST_ID, email: TEST_EMAIL, plan: 'free' });

  const found = await db.select().from(users).where(eq(users.id, TEST_ID));
  if (found.length !== 1) {
    console.error(`[db-smoke] SELECT returned ${found.length} rows, expected 1`);
    process.exit(1);
  }
  const row = found[0]!;
  console.log(`[db-smoke] SELECT ok — plan=${row.plan} createdAt=${row.createdAt.toISOString()}`);

  await db.delete(users).where(eq(users.id, TEST_ID));

  const after = await db.select().from(users).where(eq(users.id, TEST_ID));
  if (after.length !== 0) {
    console.error('[db-smoke] DELETE left ghost row');
    process.exit(1);
  }

  console.log('[db-smoke] PASS — INSERT/SELECT/DELETE round-trip clean');
}

main().catch((err) => {
  console.error('[db-smoke] FATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});

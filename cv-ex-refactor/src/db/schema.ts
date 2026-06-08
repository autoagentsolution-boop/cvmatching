// Postgres schema for the jobfit-db-pool-monetize plan (260606-1231).
//
// 6 tables — jobs, users, user_seen_job, subscriptions, sepay_webhook_events,
// orders. pgvector extension required (see scripts/db-enable-pgvector.ts).
//
// Embedding is `vector(768)` matching Gemini gemini-embedding-001 L2-normalized
// output, replacing the base64 Float32Array string carried in the old KV `Job`
// shape (src/lib/jobs/types.ts). Phase 02 data-access layer converts between
// the two representations at the boundary.
//
// HNSW index on `jobs.embedding vector_cosine_ops` is appended manually to the
// generated migration SQL — drizzle-kit 0.31 does not emit pgvector index
// syntax cleanly. See drizzle/0000_init.sql for the appended block.

import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from 'drizzle-orm/pg-core';

// ---------- jobs ----------------------------------------------------------

export const jobs = pgTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    company: text('company').notNull(),
    vertical: text('vertical').notNull(), // 'tech'|'marketing'|'finance'|'sales'|'ops'|'other'
    subVertical: text('sub_vertical'),
    seniority: text('seniority').notNull(), // 'intern'|'junior'|'mid'|'senior'|'lead'
    tier: text('tier'), // company-tier: 'high'|'mid'|'startup'
    description: text('description').notNull(),
    sourceUrl: text('source_url').notNull(),
    source: text('source').notNull(), // 'itviec'|'topcv'|'vnw'|'vl24h'|'other'
    location: text('location').notNull(),
    postedAt: timestamp('posted_at', { withTimezone: true, mode: 'date' }).notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true, mode: 'date' }).notNull(),
    mustHaves: jsonb('must_haves').$type<string[]>(),
    companyId: text('company_id'),
    active: boolean('active').notNull().default(true),
    embedding: vector('embedding', { dimensions: 768 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Source URL uniqueness — prevents duplicate ingest of the same posting.
    uniqueIndex('jobs_source_url_unique').on(t.sourceUrl),
    // Partial b-tree for the hot path: recommend route filters by active+vertical
    // before HNSW kicks in for ranking.
    index('jobs_active_vertical_idx')
      .on(t.active, t.vertical)
      .where(sql`active = true`),
    // NOTE: HNSW index on `embedding vector_cosine_ops` is appended to the
    // generated SQL manually (see drizzle/0000_init.sql).
  ],
);

export type JobRow = typeof jobs.$inferSelect;
export type NewJobRow = typeof jobs.$inferInsert;

// ---------- users ---------------------------------------------------------

export const users = pgTable('users', {
  id: text('id').primaryKey(), // NextAuth session userId (Google sub)
  email: text('email').unique(),
  plan: text('plan').notNull().default('free'), // 'free'|'paid'
  planUpdatedAt: timestamp('plan_updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

// ---------- user_seen_job --------------------------------------------------

export const userSeenJob = pgTable(
  'user_seen_job',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    seenAt: timestamp('seen_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.jobId] }),
    index('user_seen_job_seen_at_idx').on(t.userId, t.seenAt),
  ],
);

export type UserSeenJobRow = typeof userSeenJob.$inferSelect;
export type NewUserSeenJobRow = typeof userSeenJob.$inferInsert;

// ---------- subscriptions -------------------------------------------------

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull(), // 'active'|'expired'|'cancelled'|'pending'
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true, mode: 'date' }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true, mode: 'date' }).notNull(),
    sepayOrderId: text('sepay_order_id').unique(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('subscriptions_user_active_idx').on(t.userId, t.status)],
);

export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type NewSubscriptionRow = typeof subscriptions.$inferInsert;

// ---------- sepay_webhook_events ------------------------------------------

export const sepayWebhookEvents = pgTable('sepay_webhook_events', {
  // SePay's transaction id — idempotency key. Replay-safe.
  eventId: text('event_id').primaryKey(),
  payload: jsonb('payload').notNull(),
  processed: boolean('processed').notNull().default(false),
  processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' }),
  error: text('error'),
  receivedAt: timestamp('received_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
});

export type SepayWebhookEventRow = typeof sepayWebhookEvents.$inferSelect;
export type NewSepayWebhookEventRow = typeof sepayWebhookEvents.$inferInsert;

// ---------- orders --------------------------------------------------------

export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(), // crypto.randomUUID()
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    amountVnd: integer('amount_vnd').notNull(),
    status: text('status').notNull(), // 'pending'|'completed'|'expired'
    // Transaction content string "RR <orderId>" matched against SePay webhook.
    paymentId: text('payment_id').notNull(),
    // How the webhook matched this order: content-parse | amount-window | amount-only | null.
    matchMethod: text('match_method'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),
    metadata: jsonb('metadata'),
  },
  (t) => [
    // Partial b-tree on pending orders — webhook lookup hot path.
    index('orders_pending_amount_idx')
      .on(t.status, t.amountVnd, t.createdAt)
      .where(sql`status = 'pending'`),
  ],
);

export type OrderRow = typeof orders.$inferSelect;
export type NewOrderRow = typeof orders.$inferInsert;

// ---------- user_cvs ----------------------------------------------------------
//
// Multi-CV library: each authenticated user may store up to N parsed CV texts.
// `content` holds the normalized plain-text output of parse-pdf / parse-docx.
// `original_bytes` + `original_mime` (Phase 3 add-on) preserve the uploaded file
// so SourceDocumentCard can render the real PDF/Word view via `<embed>` or
// mammoth-to-HTML instead of a styled plain-text approximation. Bytes are
// capped at 5 MB by the import route — Postgres TOAST handles large rows.
// Nullable to keep existing rows valid; UI falls back to styled-text render
// when original_bytes is null.
// `is_default` marks the CV pre-selected when entering a workflow; at most one
// row per user may have is_default = true (enforced by partial unique index).

export const userCvs = pgTable(
  'user_cvs',
  {
    id: text('id').primaryKey(), // crypto.randomUUID()
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // user-facing label, e.g. "Senior Backend — Apr 2026"
    content: text('content').notNull(), // parsed CV text
    originalBytes: customType<{ data: Buffer; notNull: false; default: false }>({
      dataType() {
        return 'bytea';
      },
    })('original_bytes'),
    originalMime: text('original_mime'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('user_cvs_user_id_idx').on(t.userId, t.updatedAt),
    // Partial unique: enforce at most one default CV per user.
    uniqueIndex('user_cvs_one_default_per_user')
      .on(t.userId)
      .where(sql`is_default = true`),
  ],
);

export type UserCvRow = typeof userCvs.$inferSelect;
export type NewUserCvRow = typeof userCvs.$inferInsert;

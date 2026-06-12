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
  pgEnum,
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

// ---------- applied_jobs --------------------------------------------------
//
// User explicitly clicked "Apply ngay" on a Job Fit detail page. Tracked so
// Interview Practice can offer "practice for a job you applied to" without
// re-running Job Fit. PK is composite (user_id, job_id) so a second click is
// a no-op via ON CONFLICT DO NOTHING — idempotent fire-and-forget from the
// client. `source` distinguishes the entry surface; check constraint enforces
// the enum in the DB layer (TS does it at the API boundary).

export const appliedJobs = pgTable(
  'applied_jobs',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    source: text('source').notNull(), // 'job_fit' | 'manual'
    appliedAt: timestamp('applied_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.jobId] }),
    // Hot path: dashboard "your applied jobs" list ordered by recency.
    index('idx_applied_jobs_user_recent').on(t.userId, t.appliedAt),
  ],
);

export type AppliedJobRow = typeof appliedJobs.$inferSelect;
export type NewAppliedJobRow = typeof appliedJobs.$inferInsert;

// ---------- interview_sessions --------------------------------------------
//
// Interview Practice session. Two modes share one table — `mode='job_fit'`
// rows reference a real `jobs.id`; `mode='standalone'` rows carry only a
// `role_title` (free-text). Uniqueness is split via two partial unique
// indexes so re-attempt is allowed after a session is abandoned by the 24h
// cron (status='abandoned' excluded from the predicate).
//
// `role_title_hash` is a STORED generated column — sha256(lower(trim(...)))
// hex — so equality lookups in the standalone partial unique do not depend
// on whitespace/case. Drizzle 0.31 cannot emit GENERATED ALWAYS AS STORED
// for text/sql expressions, so the migration SQL is hand-tuned (see the
// generated SQL file under cv-ex-refactor/drizzle/).
//
// `questions` JSONB carries the 10-question payload from the LLM gen call;
// after grading, each question is mutated in place with `user_answer` +
// `grade` so the gen+grade lineage stays in one document. `dual_lens` is
// the 4-quadrant analysis written alongside questions on the gen call.

export const interviewStatus = pgEnum('interview_status', ['in_progress', 'completed', 'abandoned']);
export const interviewMode = pgEnum('interview_mode', ['job_fit', 'standalone']);

export const interviewSessions = pgTable(
  'interview_sessions',
  {
    id: text('id').primaryKey(), // crypto.randomUUID()
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mode: interviewMode('mode').notNull(),
    // job_fit mode: FK to jobs. standalone mode: null.
    jobId: text('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    // standalone mode: free-text role label entered by user. null in job_fit mode.
    roleTitle: text('role_title'),
    // STORED generated column — see migration SQL for the GENERATED ALWAYS AS clause.
    // `.generatedAlwaysAs` flags the column non-insertable in $inferInsert so
    // callers cannot try to write the hash directly. drizzle-kit 0.31 does not
    // emit STORED for this expression so the migration SQL is hand-tuned.
    roleTitleHash: text('role_title_hash').generatedAlwaysAs(
      sql`encode(sha256(lower(btrim(coalesce("role_title", '')))::bytea), 'hex')`,
    ),
    // CV anchor role: which role within the user's CV the practice targets.
    anchorRoleTitle: text('anchor_role_title').notNull(),
    status: interviewStatus('status').notNull().default('in_progress'),
    // LLM gen output — { questions: [...10], dualLens: {...} }. After grading,
    // each question gains user_answer + grade keys merged in place.
    questions: jsonb('questions').notNull(),
    dualLens: jsonb('dual_lens').notNull(),
    // Per-session overall score (0..100) computed by the grade call. null
    // while status='in_progress'.
    overallScore: integer('overall_score'),
    // Post-grade study plan from the LLM — 2-4 themed weakness clusters
    // with courses + free resources. Nullable: only set after the user
    // explicitly clicks "Generate study plan" on the results page.
    // 1-time generation per session (re-roll disabled v1).
    studyPlan: jsonb('study_plan'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    // Partial unique — one active session per (user, job) in job_fit mode.
    // Excludes abandoned so the 24h cron sweep unblocks re-attempt.
    uniqueIndex('uq_interview_jobfit_active')
      .on(t.userId, t.jobId)
      .where(sql`mode = 'job_fit' AND job_id IS NOT NULL AND status <> 'abandoned'`),
    // Partial unique — one active session per (user, role_title_hash) in standalone.
    uniqueIndex('uq_interview_standalone_active')
      .on(t.userId, t.roleTitleHash)
      .where(sql`mode = 'standalone' AND role_title_hash IS NOT NULL AND status <> 'abandoned'`),
    // History page hot path: list user's sessions ordered by recency.
    index('idx_interview_user_recent').on(t.userId, t.createdAt),
    // Cron sweep: pick up stale in_progress rows. Partial b-tree minimizes
    // scan to only the rows the cron cares about.
    index('idx_interview_in_progress_for_cron')
      .on(t.createdAt)
      .where(sql`status = 'in_progress'`),
  ],
);

export type InterviewSessionRow = typeof interviewSessions.$inferSelect;
export type NewInterviewSessionRow = typeof interviewSessions.$inferInsert;

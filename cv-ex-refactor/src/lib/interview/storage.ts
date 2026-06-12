// Interview session storage — Drizzle CRUD over `interview_sessions`.
//
// All functions enforce userId ownership at the query layer so callers don't
// need to hand-roll an authorization check after a load. The unique-active
// lookup matches the two partial unique indexes in the schema (jobfit vs
// standalone) and is used by the start route to detect resumable sessions.

import { and, desc, eq, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { getDb, interviewSessions } from '@/db';
import type { InterviewQuestion, DualLens } from '@/lib/llm/schemas-interview';
import type { ResolvedLocale } from '@/lib/llm/detect-locale';

export type SessionMode = 'job_fit' | 'standalone';
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

// Locale is persisted as a sibling key on the `dual_lens` JSONB to avoid
// a schema migration just for one text column. Read-back strips it
// before exposing the typed DualLens to callers.
type StoredDualLens = DualLens & { __locale?: ResolvedLocale };

export interface PersistedSession {
  id: string;
  userId: string;
  mode: SessionMode;
  jobId: string | null;
  roleTitle: string | null;
  anchorRoleTitle: string;
  status: SessionStatus;
  questions: InterviewQuestion[];
  dualLens: DualLens;
  /** Resolved at start time; null on legacy sessions created before locale persistence shipped. */
  locale: ResolvedLocale | null;
  overallScore: number | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface CreateSessionInput {
  userId: string;
  mode: SessionMode;
  jobId?: string | null;
  roleTitle?: string | null;
  anchorRoleTitle: string;
  questions: InterviewQuestion[];
  dualLens: DualLens;
  /** Resolved locale ('vi' | 'en') — persisted so grade follows same language. */
  locale: ResolvedLocale;
}

function rowToSession(r: typeof interviewSessions.$inferSelect): PersistedSession {
  const stored = r.dualLens as StoredDualLens;
  const { __locale, ...dualLens } = stored;
  return {
    id: r.id,
    userId: r.userId,
    mode: r.mode as SessionMode,
    jobId: r.jobId,
    roleTitle: r.roleTitle,
    anchorRoleTitle: r.anchorRoleTitle,
    status: r.status as SessionStatus,
    questions: r.questions as InterviewQuestion[],
    dualLens: dualLens as DualLens,
    locale: __locale ?? null,
    overallScore: r.overallScore,
    createdAt: r.createdAt,
    completedAt: r.completedAt,
  };
}

export async function createSession(input: CreateSessionInput): Promise<PersistedSession> {
  const id = crypto.randomUUID();
  const db = getDb();
  const dualLensWithLocale: StoredDualLens = { ...input.dualLens, __locale: input.locale };
  const [row] = await db
    .insert(interviewSessions)
    .values({
      id,
      userId: input.userId,
      mode: input.mode,
      jobId: input.jobId ?? null,
      roleTitle: input.roleTitle ?? null,
      anchorRoleTitle: input.anchorRoleTitle,
      questions: input.questions,
      dualLens: dualLensWithLocale,
    })
    .returning();
  if (!row) throw new Error('createSession: insert returned no row');
  return rowToSession(row);
}

export async function getSessionById(
  id: string,
  userId: string,
): Promise<PersistedSession | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(interviewSessions)
    .where(and(eq(interviewSessions.id, id), eq(interviewSessions.userId, userId)))
    .limit(1);
  const row = rows[0];
  return row ? rowToSession(row) : null;
}

/**
 * Find an active (non-abandoned) session matching the partial-unique-index
 * predicates. Returns null when no active session exists for the candidate
 * key, signalling that the start route can proceed with a new INSERT.
 *
 * job_fit branch: matches (userId, jobId) where jobId is non-null and
 * status <> 'abandoned'.
 * standalone branch: matches (userId, role_title_hash) where the hash is
 * generated server-side from `roleTitle`. We re-derive via the same
 * lower(btrim(...)) → sha256 hex expression used by the GENERATED column.
 */
export async function findActiveSessionByUniqueKey(params: {
  userId: string;
  mode: SessionMode;
  jobId?: string | null;
  roleTitle?: string | null;
}): Promise<PersistedSession | null> {
  const db = getDb();

  if (params.mode === 'job_fit') {
    if (!params.jobId) return null;
    const rows = await db
      .select()
      .from(interviewSessions)
      .where(
        and(
          eq(interviewSessions.userId, params.userId),
          eq(interviewSessions.mode, 'job_fit'),
          eq(interviewSessions.jobId, params.jobId),
          isNotNull(interviewSessions.jobId),
          sql`${interviewSessions.status} <> 'abandoned'`,
        ),
      )
      .limit(1);
    return rows[0] ? rowToSession(rows[0]) : null;
  }

  // standalone — match by the generated hash via the same expression.
  if (!params.roleTitle) return null;
  const rows = await db
    .select()
    .from(interviewSessions)
    .where(
      and(
        eq(interviewSessions.userId, params.userId),
        eq(interviewSessions.mode, 'standalone'),
        isNull(interviewSessions.jobId),
        sql`${interviewSessions.roleTitleHash} = encode(sha256(lower(btrim(${params.roleTitle}))::bytea), 'hex')`,
        sql`${interviewSessions.status} <> 'abandoned'`,
      ),
    )
    .limit(1);
  return rows[0] ? rowToSession(rows[0]) : null;
}

export async function updateGrades(
  id: string,
  userId: string,
  patch: { questions: InterviewQuestion[]; overallScoreInt: number },
): Promise<void> {
  const db = getDb();
  await db
    .update(interviewSessions)
    .set({
      questions: patch.questions,
      overallScore: patch.overallScoreInt,
      status: 'completed',
      completedAt: new Date(),
    })
    .where(and(eq(interviewSessions.id, id), eq(interviewSessions.userId, userId)));
}

export type HistoryRow = Omit<PersistedSession, 'questions' | 'dualLens' | 'locale'>;

export async function listUserHistory(userId: string, limit: number): Promise<HistoryRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: interviewSessions.id,
      userId: interviewSessions.userId,
      mode: interviewSessions.mode,
      jobId: interviewSessions.jobId,
      roleTitle: interviewSessions.roleTitle,
      anchorRoleTitle: interviewSessions.anchorRoleTitle,
      status: interviewSessions.status,
      overallScore: interviewSessions.overallScore,
      createdAt: interviewSessions.createdAt,
      completedAt: interviewSessions.completedAt,
    })
    .from(interviewSessions)
    .where(eq(interviewSessions.userId, userId))
    .orderBy(desc(interviewSessions.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    ...r,
    mode: r.mode as SessionMode,
    status: r.status as SessionStatus,
  }));
}

/**
 * Cron handler — flip `in_progress` rows older than 24h to `abandoned`.
 * Returns the count of rows updated. Pure DB function; cron route wraps
 * it with auth and the response envelope.
 */
export async function markAbandoned(olderThan: Date): Promise<number> {
  const db = getDb();
  const result = await db
    .update(interviewSessions)
    .set({ status: 'abandoned' })
    .where(
      and(
        eq(interviewSessions.status, 'in_progress'),
        lt(interviewSessions.createdAt, olderThan),
      ),
    )
    .returning({ id: interviewSessions.id });
  return result.length;
}

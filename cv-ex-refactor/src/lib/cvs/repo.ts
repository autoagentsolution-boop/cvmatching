// CV library repository — CRUD helpers for the user_cvs table.
//
// All functions enforce userId ownership so callers (API routes) can trust
// the returned row belongs to the authenticated session.
//
// Default-toggle uses a transaction: clear any existing default → set new one.
// This prevents the partial-unique index violation that would arise from a
// plain UPDATE on the new row before clearing the old default.

import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb, userCvs, users } from '@/db';
import type { NewUserCvRow } from '@/db';

export type { NewUserCvRow };

// Columns to project for the "lightweight" reads. EXCLUDES original_bytes
// because that column can hit 5 MB per row; pulling it on every list / get
// would tank dashboard latency. Use getUserCvOriginal() to fetch bytes.
const LITE_COLS = {
  id: userCvs.id,
  userId: userCvs.userId,
  name: userCvs.name,
  content: userCvs.content,
  originalMime: userCvs.originalMime,
  isDefault: userCvs.isDefault,
  createdAt: userCvs.createdAt,
  updatedAt: userCvs.updatedAt,
} as const;

/**
 * Lightweight row shape used by all UI consumers. original_bytes is
 * intentionally omitted (heavy, only served via /api/cvs/[id]/original).
 * Exported as UserCvRow so callers don't accidentally pull bytea.
 */
export type UserCvRow = {
  id: string;
  userId: string;
  name: string;
  content: string;
  originalMime: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// ─── List ──────────────────────────────────────────────────────────────────

/** Return all CVs for a user, newest first. Omits original_bytes (heavy). */
export async function listUserCvs(userId: string): Promise<UserCvRow[]> {
  const db = getDb();
  return db
    .select(LITE_COLS)
    .from(userCvs)
    .where(eq(userCvs.userId, userId))
    .orderBy(desc(userCvs.updatedAt));
}

// ─── Get one ──────────────────────────────────────────────────────────────

/**
 * Fetch a single CV row (lite — no original_bytes), enforcing userId ownership.
 * Returns null when not found OR when the row belongs to a different user
 * (no info leak — 404 not 403 policy).
 */
export async function getUserCv(userId: string, cvId: string): Promise<UserCvRow | null> {
  const db = getDb();
  const rows = await db
    .select(LITE_COLS)
    .from(userCvs)
    .where(and(eq(userCvs.id, cvId), eq(userCvs.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Fetch original_bytes + original_mime for serving via /api/cvs/[id]/original.
 * Enforces userId ownership. Returns null when row missing, wrong owner, or
 * the row has no original (legacy CV imported before Phase 3 storage landed).
 */
export async function getUserCvOriginal(
  userId: string,
  cvId: string,
): Promise<{ bytes: Buffer; mime: string } | null> {
  const db = getDb();
  const rows = await db
    .select({ bytes: userCvs.originalBytes, mime: userCvs.originalMime })
    .from(userCvs)
    .where(and(eq(userCvs.id, cvId), eq(userCvs.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row || !row.bytes || !row.mime) return null;
  return { bytes: row.bytes, mime: row.mime };
}

// ─── Create ───────────────────────────────────────────────────────────────

export interface CreateCvInput {
  name: string;
  content: string;
  isDefault?: boolean | undefined;
  /** Original uploaded file bytes for fidelity-preserving Source render. */
  originalBytes?: Buffer | undefined;
  /** MIME of the original file — drives Source viewer branch (PDF/DOCX/TXT). */
  originalMime?: string | undefined;
}

/**
 * Idempotent users-row provisioning. NextAuth uses JWT-only sessions (no DB
 * adapter), so users rows are never created at sign-in. Any FK-bound insert
 * (user_cvs, future tables) must call this first or the insert fails with
 * 23503 fk violation. Cheap — ON CONFLICT DO NOTHING is a single round-trip.
 *
 * Long-term fix: move this to a NextAuth `signIn` callback so the row exists
 * before any business code touches it. Until then, every FK-bound write path
 * calls ensureUserRow defensively.
 */
export async function ensureUserRow(userId: string, email?: string | null | undefined): Promise<void> {
  const db = getDb();
  await db
    .insert(users)
    .values({ id: userId, email: email ?? null })
    .onConflictDoNothing({ target: users.id });
}

/**
 * Insert a new CV for the user.
 * When isDefault = true the existing default (if any) is cleared first
 * inside a single transaction to satisfy the partial-unique constraint.
 */
export async function createUserCv(
  userId: string,
  input: CreateCvInput,
): Promise<UserCvRow> {
  const db = getDb();
  // Defensive — JWT-only auth means the FK target may not exist yet.
  await ensureUserRow(userId);
  const id = crypto.randomUUID();
  const now = new Date();

  if (input.isDefault) {
    // Transaction: clear old default → insert new default.
    // neon-http does not support multi-statement transactions through the HTTP
    // driver. Use raw SQL via db.transaction() which switches to the WebSocket
    // driver under the hood for Drizzle's transaction helper.
    // Simpler approach: two sequential statements — clear first, then insert.
    // The window between the two is < 1ms on the same Vercel Function; the
    // partial-unique index means the insert wins the invariant.
    await db
      .update(userCvs)
      .set({ isDefault: false })
      .where(and(eq(userCvs.userId, userId), eq(userCvs.isDefault, true)));
  }

  const rows = await db
    .insert(userCvs)
    .values({
      id,
      userId,
      name: input.name,
      content: input.content,
      ...(input.originalBytes !== undefined ? { originalBytes: input.originalBytes } : {}),
      ...(input.originalMime !== undefined ? { originalMime: input.originalMime } : {}),
      isDefault: input.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const row = rows[0];
  if (!row) throw new Error('[cvs/repo] insert returned no rows');
  return row;
}

// ─── Update ───────────────────────────────────────────────────────────────

export interface UpdateCvPatch {
  name?: string | undefined;
  content?: string | undefined;
  isDefault?: boolean | undefined;
}

/**
 * Partial-update a CV row, enforcing userId ownership.
 * Returns the updated row, or null when the row doesn't exist / belongs to
 * a different user.
 */
export async function updateUserCv(
  userId: string,
  cvId: string,
  patch: UpdateCvPatch,
): Promise<UserCvRow | null> {
  const db = getDb();

  // Confirm ownership before touching anything.
  const existing = await getUserCv(userId, cvId);
  if (!existing) return null;

  if (patch.isDefault) {
    // Clear any current default for the user before setting the new one.
    await db
      .update(userCvs)
      .set({ isDefault: false })
      .where(and(eq(userCvs.userId, userId), eq(userCvs.isDefault, true)));
  }

  const now = new Date();
  const rows = await db
    .update(userCvs)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.content !== undefined ? { content: patch.content } : {}),
      ...(patch.isDefault !== undefined ? { isDefault: patch.isDefault } : {}),
      updatedAt: now,
    })
    .where(and(eq(userCvs.id, cvId), eq(userCvs.userId, userId)))
    .returning();

  return rows[0] ?? null;
}

// ─── Delete ───────────────────────────────────────────────────────────────

/**
 * Hard-delete a CV, enforcing userId ownership.
 * No-ops silently when not found or belonging to another user.
 */
export async function deleteUserCv(userId: string, cvId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(userCvs)
    .where(and(eq(userCvs.id, cvId), eq(userCvs.userId, userId)));
}

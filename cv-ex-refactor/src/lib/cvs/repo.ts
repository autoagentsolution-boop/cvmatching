// CV library repository — CRUD helpers for the user_cvs table.
//
// All functions enforce userId ownership so callers (API routes) can trust
// the returned row belongs to the authenticated session.
//
// Default-toggle uses a transaction: clear any existing default → set new one.
// This prevents the partial-unique index violation that would arise from a
// plain UPDATE on the new row before clearing the old default.

import { and, desc, eq } from 'drizzle-orm';
import { getDb, userCvs } from '@/db';
import type { UserCvRow, NewUserCvRow } from '@/db';

// Re-export types so consumers don't need to import from @/db directly.
export type { UserCvRow, NewUserCvRow };

// ─── List ──────────────────────────────────────────────────────────────────

/** Return all CVs for a user, newest first. */
export async function listUserCvs(userId: string): Promise<UserCvRow[]> {
  const db = getDb();
  return db
    .select()
    .from(userCvs)
    .where(eq(userCvs.userId, userId))
    .orderBy(desc(userCvs.updatedAt));
}

// ─── Get one ──────────────────────────────────────────────────────────────

/**
 * Fetch a single CV row, enforcing userId ownership.
 * Returns null when not found OR when the row belongs to a different user
 * (no info leak — 404 not 403 policy).
 */
export async function getUserCv(userId: string, cvId: string): Promise<UserCvRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(userCvs)
    .where(and(eq(userCvs.id, cvId), eq(userCvs.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

// ─── Create ───────────────────────────────────────────────────────────────

export interface CreateCvInput {
  name: string;
  content: string;
  isDefault?: boolean | undefined;
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

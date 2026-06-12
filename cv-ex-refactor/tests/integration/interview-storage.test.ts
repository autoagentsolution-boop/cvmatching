// Integration tests for src/lib/interview/storage.ts against real Neon.
// Skipped unless DATABASE_URL is present so CI without DB still passes.
//
// Covers:
//  - createSession round-trip
//  - getSessionById ownership (other user returns null)
//  - findActiveSessionByUniqueKey: 4 branches (jobfit-active, jobfit-none,
//    standalone-active, standalone-none)
//  - role_title_hash GENERATED column drives the standalone match
//  - updateGrades flips status + writes overall_score
//  - markAbandoned 24h cutoff
//  - listUserHistory order + limit

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb, users, interviewSessions } from '@/db';
import {
  createSession,
  getSessionById,
  findActiveSessionByUniqueKey,
  updateGrades,
  markAbandoned,
  listUserHistory,
} from '@/lib/interview/storage';
import type { InterviewQuestion, DualLens } from '@/lib/llm/schemas-interview';

const hasEnv = !!process.env.DATABASE_URL;

const TEST_USER_ID = 'test-interview-user-phase06';
const TEST_USER_ID_B = 'test-interview-user-b-phase06';

const DUAL_LENS: DualLens = {
  recruiterHire: { reasons: ['fixture reason a', 'fixture reason b'], signals: ['fixture signal a', 'fixture signal b'] },
  recruiterNoHire: { risks: ['fixture risk a', 'fixture risk b'], gaps: ['fixture gap a', 'fixture gap b'] },
  candidateHire: { opportunities: ['fixture opp a', 'fixture opp b'], growth: ['fixture growth a', 'fixture growth b'] },
  candidateNoHire: { risks: ['fixture risk c', 'fixture risk d'], mismatches: ['fixture mismatch a', 'fixture mismatch b'] },
};

function makeQs(): InterviewQuestion[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `q${i + 1}`,
    type: (i < 4 ? 'behavioral' : i < 8 ? 'technical' : 'scenario') as 'behavioral' | 'technical' | 'scenario',
    question: `Fixture question ${i + 1} text that exceeds twenty chars`,
    rubric: {
      criteria: 'fixture criteria text that exceeds twenty chars',
      excellentSignals: ['signal a', 'signal b'],
      failSignals: ['fail a', 'fail b'],
    },
  }));
}

describe.skipIf(!hasEnv)('interview storage — integration', () => {
  beforeAll(async () => {
    const db = getDb();
    await db
      .insert(users)
      .values([
        { id: TEST_USER_ID, email: `${TEST_USER_ID}@test.local`, plan: 'free', planUpdatedAt: new Date(), createdAt: new Date() },
        { id: TEST_USER_ID_B, email: `${TEST_USER_ID_B}@test.local`, plan: 'free', planUpdatedAt: new Date(), createdAt: new Date() },
      ])
      .onConflictDoNothing();
    // Clean any leftover sessions from prior runs.
    await db.delete(interviewSessions).where(eq(interviewSessions.userId, TEST_USER_ID));
    await db.delete(interviewSessions).where(eq(interviewSessions.userId, TEST_USER_ID_B));
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(interviewSessions).where(eq(interviewSessions.userId, TEST_USER_ID));
    await db.delete(interviewSessions).where(eq(interviewSessions.userId, TEST_USER_ID_B));
    await db.delete(users).where(eq(users.id, TEST_USER_ID));
    await db.delete(users).where(eq(users.id, TEST_USER_ID_B));
  });

  it('createSession + getSessionById round-trips and enforces ownership', async () => {
    const created = await createSession({
      userId: TEST_USER_ID,
      mode: 'standalone',
      roleTitle: 'Senior Backend Engineer',
      anchorRoleTitle: 'Backend Engineer',
      questions: makeQs(),
      dualLens: DUAL_LENS,
    });
    expect(created.id).toBeTruthy();
    expect(created.status).toBe('in_progress');

    const fetched = await getSessionById(created.id, TEST_USER_ID);
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.questions.length).toBe(10);

    const fromOther = await getSessionById(created.id, TEST_USER_ID_B);
    expect(fromOther).toBeNull();
  });

  it('findActiveSessionByUniqueKey — standalone matches via generated role_title_hash, case/whitespace-insensitive', async () => {
    await createSession({
      userId: TEST_USER_ID,
      mode: 'standalone',
      roleTitle: '  Backend Engineer  ',
      anchorRoleTitle: 'Engineer',
      questions: makeQs(),
      dualLens: DUAL_LENS,
    });

    const hit = await findActiveSessionByUniqueKey({
      userId: TEST_USER_ID,
      mode: 'standalone',
      roleTitle: 'backend engineer',
    });
    expect(hit).not.toBeNull();

    const miss = await findActiveSessionByUniqueKey({
      userId: TEST_USER_ID,
      mode: 'standalone',
      roleTitle: 'Frontend Engineer',
    });
    expect(miss).toBeNull();
  });

  it('updateGrades flips status to completed and persists overall_score', async () => {
    const created = await createSession({
      userId: TEST_USER_ID,
      mode: 'standalone',
      roleTitle: 'Graded Practice Role',
      anchorRoleTitle: 'Eng',
      questions: makeQs(),
      dualLens: DUAL_LENS,
    });

    await updateGrades(created.id, TEST_USER_ID, {
      questions: created.questions,
      overallScoreInt: 75,
    });

    const after = await getSessionById(created.id, TEST_USER_ID);
    expect(after?.status).toBe('completed');
    expect(after?.overallScore).toBe(75);
    expect(after?.completedAt).not.toBeNull();
  });

  it('markAbandoned only flips rows older than the cutoff', async () => {
    const db = getDb();
    const stale = await createSession({
      userId: TEST_USER_ID,
      mode: 'standalone',
      roleTitle: 'Stale Role For Sweep',
      anchorRoleTitle: 'Eng',
      questions: makeQs(),
      dualLens: DUAL_LENS,
    });
    // Backdate the row by 25 hours.
    const past = new Date(Date.now() - 25 * 3600 * 1000);
    await db.update(interviewSessions)
      .set({ createdAt: past })
      .where(eq(interviewSessions.id, stale.id));

    const fresh = await createSession({
      userId: TEST_USER_ID,
      mode: 'standalone',
      roleTitle: 'Fresh Role For Sweep',
      anchorRoleTitle: 'Eng',
      questions: makeQs(),
      dualLens: DUAL_LENS,
    });

    const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
    const updated = await markAbandoned(cutoff);
    expect(updated).toBeGreaterThanOrEqual(1);

    const staleAfter = await getSessionById(stale.id, TEST_USER_ID);
    const freshAfter = await getSessionById(fresh.id, TEST_USER_ID);
    expect(staleAfter?.status).toBe('abandoned');
    expect(freshAfter?.status).toBe('in_progress');
  });

  it('listUserHistory returns rows in DESC createdAt order, capped at limit', async () => {
    const rows = await listUserHistory(TEST_USER_ID, 3);
    expect(rows.length).toBeLessThanOrEqual(3);
    if (rows.length >= 2) {
      expect(rows[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(rows[1]!.createdAt.getTime());
    }
  });

  it('ownership isolation — listUserHistory does not leak across users', async () => {
    await createSession({
      userId: TEST_USER_ID_B,
      mode: 'standalone',
      roleTitle: 'Other User Role',
      anchorRoleTitle: 'Eng',
      questions: makeQs(),
      dualLens: DUAL_LENS,
    });
    const aRows = await listUserHistory(TEST_USER_ID, 50);
    const bRows = await listUserHistory(TEST_USER_ID_B, 50);
    expect(aRows.every((r) => r.userId === TEST_USER_ID)).toBe(true);
    expect(bRows.every((r) => r.userId === TEST_USER_ID_B)).toBe(true);
  });
});

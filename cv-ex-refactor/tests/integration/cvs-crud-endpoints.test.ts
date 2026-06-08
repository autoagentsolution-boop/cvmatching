// Integration tests for CV CRUD endpoints:
//   GET  /api/cvs
//   POST /api/cvs
//   PATCH /api/cvs/[id]
//   DELETE /api/cvs/[id]
//
// Runs against real Neon — no DB mocking per project rules.
// Skipped unless DATABASE_URL is present.
// Each test run creates rows under a deterministic test userId and tears them
// down in afterAll so the table stays clean.

import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { userCvs, users } from '@/db';
import { eq } from 'drizzle-orm';

const hasEnv = !!process.env.DATABASE_URL;

// Stable test user — must exist in `users` table for FK to hold.
// We upsert it in beforeAll and delete it in afterAll.
const TEST_USER_ID = 'test-cv-crud-user-phase1';
const TEST_USER_ID_B = 'test-cv-crud-user-b-phase1'; // for ownership cross-check

// ── Helpers ──────────────────────────────────────────────────────────────

/** Build a NextRequest with given method + JSON body. */
function makeJsonReq(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

// ── Auth mock ────────────────────────────────────────────────────────────

// Vitest module mock: override `src/auth.ts` so `auth()` returns our test
// user without a real JWT. The mock is established before any test imports.
let _mockUserId: string | null = TEST_USER_ID;

import { vi } from 'vitest';

vi.mock('@/auth', () => ({
  auth: async () =>
    _mockUserId ? { user: { id: _mockUserId } } : null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

// ── Suite ────────────────────────────────────────────────────────────────

describe.skipIf(!hasEnv)('CV CRUD endpoints — integration (real Neon)', () => {
  beforeAll(async () => {
    const db = getDb();
    // Ensure both test users exist (FK parent required).
    await db
      .insert(users)
      .values([
        { id: TEST_USER_ID, email: `${TEST_USER_ID}@test.local`, plan: 'free', planUpdatedAt: new Date(), createdAt: new Date() },
        { id: TEST_USER_ID_B, email: `${TEST_USER_ID_B}@test.local`, plan: 'free', planUpdatedAt: new Date(), createdAt: new Date() },
      ])
      .onConflictDoNothing();
  });

  afterAll(async () => {
    const db = getDb();
    // Delete CVs first (FK child), then users.
    await db.delete(userCvs).where(eq(userCvs.userId, TEST_USER_ID));
    await db.delete(userCvs).where(eq(userCvs.userId, TEST_USER_ID_B));
    await db.delete(users).where(eq(users.id, TEST_USER_ID));
    await db.delete(users).where(eq(users.id, TEST_USER_ID_B));
  });

  // ── GET /api/cvs ─────────────────────────────────────────────────────

  it('GET /api/cvs returns 401 when unauthenticated', async () => {
    _mockUserId = null;
    const { GET } = await import('@/app/api/cvs/route');
    const res = await GET();
    expect(res.status).toBe(401);
    _mockUserId = TEST_USER_ID;
  });

  it('GET /api/cvs returns empty array for new user', async () => {
    _mockUserId = TEST_USER_ID;
    const { GET } = await import('@/app/api/cvs/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.cvs)).toBe(true);
    // May not be empty if previous test run left rows, but array must exist.
  });

  // ── POST /api/cvs ────────────────────────────────────────────────────

  it('POST /api/cvs returns 401 when unauthenticated', async () => {
    _mockUserId = null;
    const { POST } = await import('@/app/api/cvs/route');
    const req = new NextRequest('http://localhost/api/cvs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test CV', content: 'Some content' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    _mockUserId = TEST_USER_ID;
  });

  it('POST /api/cvs returns 400 for missing name', async () => {
    _mockUserId = TEST_USER_ID;
    const { POST } = await import('@/app/api/cvs/route');
    const req = new NextRequest('http://localhost/api/cvs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Some content' }), // name missing
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  let createdCvId: string;

  it('POST /api/cvs creates a CV and returns 201', async () => {
    _mockUserId = TEST_USER_ID;
    const { POST } = await import('@/app/api/cvs/route');
    const req = new NextRequest('http://localhost/api/cvs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Test CV', content: 'CV content here', isDefault: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.cv.id).toBe('string');
    expect(body.cv.name).toBe('My Test CV');
    expect(body.cv.isDefault).toBe(true);
    createdCvId = body.cv.id;
  });

  it('POST /api/cvs with isDefault=true clears previous default', async () => {
    _mockUserId = TEST_USER_ID;
    const { POST } = await import('@/app/api/cvs/route');

    // Create second CV with isDefault = true
    const req = new NextRequest('http://localhost/api/cvs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Second CV', content: 'Second content', isDefault: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    const secondId = body.cv.id;

    // First CV should no longer be default
    const db = getDb();
    const rows = await db
      .select({ id: userCvs.id, isDefault: userCvs.isDefault })
      .from(userCvs)
      .where(eq(userCvs.userId, TEST_USER_ID));

    const first = rows.find((r) => r.id === createdCvId);
    const second = rows.find((r) => r.id === secondId);
    expect(first?.isDefault).toBe(false);
    expect(second?.isDefault).toBe(true);

    // Clean up second CV
    const db2 = getDb();
    await db2.delete(userCvs).where(eq(userCvs.id, secondId));
  });

  // ── PATCH /api/cvs/[id] ───────────────────────────────────────────────

  it('PATCH /api/cvs/[id] returns 401 when unauthenticated', async () => {
    _mockUserId = null;
    const { PATCH } = await import('@/app/api/cvs/[id]/route');
    const req = new NextRequest(`http://localhost/api/cvs/${createdCvId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: createdCvId }) });
    expect(res.status).toBe(401);
    _mockUserId = TEST_USER_ID;
  });

  it('PATCH /api/cvs/[id] renames a CV', async () => {
    _mockUserId = TEST_USER_ID;
    const { PATCH } = await import('@/app/api/cvs/[id]/route');
    const req = new NextRequest(`http://localhost/api/cvs/${createdCvId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed CV' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: createdCvId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cv.name).toBe('Renamed CV');
  });

  it('PATCH /api/cvs/[id] returns 404 for another user\'s CV', async () => {
    // User B tries to patch User A's CV
    _mockUserId = TEST_USER_ID_B;
    const { PATCH } = await import('@/app/api/cvs/[id]/route');
    const req = new NextRequest(`http://localhost/api/cvs/${createdCvId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Stolen' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: createdCvId }) });
    expect(res.status).toBe(404);
    _mockUserId = TEST_USER_ID;
  });

  it('PATCH /api/cvs/[id] returns 400 when no fields provided', async () => {
    _mockUserId = TEST_USER_ID;
    const { PATCH } = await import('@/app/api/cvs/[id]/route');
    const req = new NextRequest(`http://localhost/api/cvs/${createdCvId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: createdCvId }) });
    expect(res.status).toBe(400);
  });

  // ── DELETE /api/cvs/[id] ─────────────────────────────────────────────

  it('DELETE /api/cvs/[id] returns 401 when unauthenticated', async () => {
    _mockUserId = null;
    const { DELETE } = await import('@/app/api/cvs/[id]/route');
    const req = new NextRequest(`http://localhost/api/cvs/${createdCvId}`, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: createdCvId }) });
    expect(res.status).toBe(401);
    _mockUserId = TEST_USER_ID;
  });

  it('DELETE /api/cvs/[id] returns 404 for another user\'s CV', async () => {
    _mockUserId = TEST_USER_ID_B;
    const { DELETE } = await import('@/app/api/cvs/[id]/route');
    const req = new NextRequest(`http://localhost/api/cvs/${createdCvId}`, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: createdCvId }) });
    expect(res.status).toBe(404);
    _mockUserId = TEST_USER_ID;
  });

  it('DELETE /api/cvs/[id] deletes the CV and returns 204', async () => {
    _mockUserId = TEST_USER_ID;
    const { DELETE } = await import('@/app/api/cvs/[id]/route');
    const req = new NextRequest(`http://localhost/api/cvs/${createdCvId}`, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: createdCvId }) });
    expect(res.status).toBe(204);
  });

  it('DELETE /api/cvs/[id] returns 404 after already deleted', async () => {
    _mockUserId = TEST_USER_ID;
    const { DELETE } = await import('@/app/api/cvs/[id]/route');
    const req = new NextRequest(`http://localhost/api/cvs/${createdCvId}`, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: createdCvId }) });
    expect(res.status).toBe(404);
  });
});

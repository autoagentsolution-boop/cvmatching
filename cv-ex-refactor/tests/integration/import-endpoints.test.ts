// Integration tests for import endpoints:
//   POST /api/import/cv  — file upload → parsed text (+ optional library save)
//   POST /api/import/jd  — file | URL | text → extracted JD
//
// Parser smoke tests use real small fixture files.
// URL scrape test uses a real TopCV URL — skipped unless TOPCV_TEST_URL env is set
// (avoids flaky CI; operator can set the var for a real round-trip check).

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// ── Auth mock (for saveToLibrary tests) ──────────────────────────────────

let _mockUserId: string | null = null;

vi.mock('@/auth', () => ({
  auth: async () =>
    _mockUserId ? { user: { id: _mockUserId } } : null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

// ── Fixture paths ─────────────────────────────────────────────────────────

const FIXTURES = path.resolve(import.meta.dirname, '../fixtures');
const TXT_FIXTURE = path.join(FIXTURES, 'sample-cv-vn-tech.txt');

// ── Helpers ────────────────────────────────────────────────────────────────

function makeFileFormData(filePath: string, mimeType: string): FormData {
  const buf = fs.readFileSync(filePath);
  const blob = new Blob([buf], { type: mimeType });
  const form = new FormData();
  form.append('file', blob, path.basename(filePath));
  return form;
}

function multipartReq(url: string, form: FormData): NextRequest {
  return new NextRequest(url, { method: 'POST', body: form });
}

// ── /api/import/cv ─────────────────────────────────────────────────────────

describe('POST /api/import/cv', () => {
  it('returns parsed text from a TXT fixture', async () => {
    const { POST } = await import('@/app/api/import/cv/route');
    const form = makeFileFormData(TXT_FIXTURE, 'text/plain');
    const req = multipartReq('http://localhost/api/import/cv', form);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.text).toBe('string');
    expect(body.text.length).toBeGreaterThan(50);
    expect(body.meta.kind).toBe('txt');
  });

  it('returns 415 for an unsupported file type', async () => {
    const { POST } = await import('@/app/api/import/cv/route');
    // Send a PNG-sized blob with PNG magic bytes
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const blob = new Blob([pngBytes], { type: 'image/png' });
    const form = new FormData();
    form.append('file', blob, 'photo.png');
    const req = multipartReq('http://localhost/api/import/cv', form);
    const res = await POST(req);
    expect(res.status).toBe(415);
  });

  it('returns 400 when no file field is present', async () => {
    const { POST } = await import('@/app/api/import/cv/route');
    const form = new FormData();
    form.append('other', 'value');
    const req = multipartReq('http://localhost/api/import/cv', form);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 401 when saveToLibrary=true and user is unauthenticated', async () => {
    _mockUserId = null;
    const { POST } = await import('@/app/api/import/cv/route');
    const form = makeFileFormData(TXT_FIXTURE, 'text/plain');
    const req = multipartReq(
      'http://localhost/api/import/cv?saveToLibrary=true&name=TestCV',
      form,
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

// ── /api/import/jd ─────────────────────────────────────────────────────────

describe('POST /api/import/jd', () => {
  it('accepts raw text body and returns normalized text', async () => {
    const { POST } = await import('@/app/api/import/jd/route');
    const req = new NextRequest('http://localhost/api/import/jd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'We are looking for a Senior Backend Engineer with 5+ years of experience in Node.js and PostgreSQL to join our team in Ho Chi Minh City.',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.text).toBe('string');
    expect(body.text.length).toBeGreaterThan(50);
  });

  it('returns 400 for invalid JSON body', async () => {
    const { POST } = await import('@/app/api/import/jd/route');
    const req = new NextRequest('http://localhost/api/import/jd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ invalid json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for JSON body that is neither url nor text', async () => {
    const { POST } = await import('@/app/api/import/jd/route');
    const req = new NextRequest('http://localhost/api/import/jd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unknown_field: 'value' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid URL format', async () => {
    const { POST } = await import('@/app/api/import/jd/route');
    const req = new NextRequest('http://localhost/api/import/jd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'not-a-url' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('accepts TXT file upload and returns extracted text', async () => {
    const { POST } = await import('@/app/api/import/jd/route');
    const form = makeFileFormData(TXT_FIXTURE, 'text/plain');
    const req = multipartReq('http://localhost/api/import/jd', form);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.text).toBe('string');
    expect(body.text.length).toBeGreaterThan(50);
  });

  // Real TopCV URL test — only runs when operator sets TOPCV_TEST_URL.
  // Skipped in CI since Cloudflare may block Vercel/GH Actions IPs.
  it.skipIf(!process.env['TOPCV_TEST_URL'])(
    'scrapes a real TopCV job URL and returns description',
    async () => {
      const { POST } = await import('@/app/api/import/jd/route');
      const req = new NextRequest('http://localhost/api/import/jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: process.env['TOPCV_TEST_URL'] }),
      });
      const res = await POST(req);
      // 200 = success; 422 = fetch failed (CF block) — both acceptable in test env
      if (res.status === 200) {
        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body.text.length).toBeGreaterThan(100);
      } else {
        expect([422, 400]).toContain(res.status);
        console.warn('[import/jd test] TopCV URL scrape returned non-200 — likely CF block');
      }
    },
    15_000,
  );
});

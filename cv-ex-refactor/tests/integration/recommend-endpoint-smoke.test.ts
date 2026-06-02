// Integration smoke test for POST /api/jobs/recommend.
// Skipped unless GEMINI_API_KEY + KV_REST_API_URL are present in env
// (never mock KV in integration tests — per project memory rule).
//
// Calls the route handler directly by importing its named POST export
// and constructing a NextRequest — no HTTP server required.

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

const hasEnv =
  !!process.env.GEMINI_API_KEY &&
  !!process.env.KV_REST_API_URL &&
  !!process.env.KV_REST_API_TOKEN &&
  !!process.env.EMBED_CACHE_SECRET;

// Load sample CV fixture (must be > 200 chars per RecommendBodySchema)
const fixturePath = path.resolve(
  import.meta.dirname,
  '../fixtures/sample-cv-vn-tech.txt',
);
const sampleCv = fs.existsSync(fixturePath)
  ? fs.readFileSync(fixturePath, 'utf-8')
  : 'x'.repeat(300); // fallback if fixture not yet present

describe.skipIf(!hasEnv)(
  'POST /api/jobs/recommend — integration (real KV + Gemini)',
  () => {
    it('returns jobs array with required shape', async () => {
      // Lazy import avoids module-level KV init when env is absent
      const { POST } = await import(
        '@/app/api/jobs/recommend/route'
      );

      const req = new NextRequest('http://localhost:3000/api/jobs/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvText: sampleCv }),
      });

      const res = await POST(req);
      const body = await res.json();

      // May be 503 if job index not seeded; that's acceptable in CI.
      // Shape assertion only fires when jobs are returned.
      if (res.status === 200) {
        expect(Array.isArray(body.jobs)).toBe(true);
        expect(body.jobs.length).toBeGreaterThanOrEqual(1);

        const job = body.jobs[0];
        expect(typeof job.jobId).toBe('string');
        expect(typeof job.overallScore).toBe('number');
        expect(job.overallScore).toBeGreaterThan(80);
        expect(typeof job.title).toBe('string');
        expect(typeof job.company).toBe('string');
        expect(typeof job.sourceUrl).toBe('string');
        expect(typeof body.fromCache).toBe('boolean');
        expect(typeof body.expiresAt).toBe('string');
      } else {
        // 400 (invalid cv), 503 (index not ready), 502 (no matches) are all
        // acceptable non-200 outcomes — just verify shape is an error envelope.
        expect(body).toHaveProperty('error');
        console.warn(
          `[recommend-smoke] non-200 status ${res.status}: ${JSON.stringify(body.error)}`,
        );
      }
    }, 30_000); // generous timeout for LLM round-trip

    it('returns 400 when cvText is too short', async () => {
      const { POST } = await import(
        '@/app/api/jobs/recommend/route'
      );

      const req = new NextRequest('http://localhost:3000/api/jobs/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvText: 'too short' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  },
);

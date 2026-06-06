// Postgres-backed jobs repository. Drizzle ORM for typed CRUD; raw SQL via
// the `sql` tag for pgvector ops (Drizzle has no first-class vector operator).
// Implements the same JobsRepo contract as the legacy KV repo so the cutover
// in Phase 4 is a one-line import swap.
//
// All embedding boundaries flow through vector-codec.ts. INSERT/UPDATE send
// pgvector literal strings cast as `::vector`; SELECT returns the same shape
// which the codec parses back to Float32Array.

import { eq, inArray, sql } from 'drizzle-orm';
import { getDb, jobs } from '@/db';
import type { Job, Seniority, Tier, Vertical } from './types';
import type { JobsRepo, TopKOpts, TopKResult } from './repo-interface';
import { float32ToPgVector } from './vector-codec';

// ─── Row ↔ domain conversion ───────────────────────────────────────────────
//
// `Job` (domain) carries `embedding: string` (base64 of Float32Array LE bytes
// — legacy KV format). For Postgres-resident code paths we keep that contract
// so existing callers (recommend route, ingest classifier) don't need touching
// before Phase 4. The base64 ↔ pgvector conversion happens here at the
// repo boundary.
//
// On SELECT, pgvector emits `[v1,v2,...,vN]` as a text-y `unknown`. We don't
// convert it back to base64 inside the hot path — only the row-shape converter
// for getJob/getJobBatch (callers that read Job.embedding for recompute).
// For topKByEmbedding, the embedding column is NOT in the SELECT — we only
// return id + score, so no conversion needed.

function rowToJob(row: typeof jobs.$inferSelect): Job {
  // Convert pgvector string back to base64 to match the legacy Job.embedding
  // contract. Only triggers when callers fetch full Job rows; topKByEmbedding
  // skips this (returns only id + score).
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    vertical: row.vertical as Vertical,
    ...(row.subVertical ? { subVertical: row.subVertical } : {}),
    seniority: row.seniority as Seniority,
    ...(row.tier ? { tier: row.tier as Tier } : {}),
    description: row.description,
    sourceUrl: row.sourceUrl,
    source: row.source as Job['source'],
    location: row.location,
    postedAt: row.postedAt.toISOString(),
    verifiedAt: row.verifiedAt.toISOString(),
    embedding: pgVectorRowToBase64(row.embedding),
    ...(row.mustHaves ? { mustHaves: row.mustHaves } : {}),
    ...(row.companyId ? { companyId: row.companyId } : {}),
  };
}

function pgVectorRowToBase64(raw: unknown): string {
  // pgvector emits text via neon-http; Drizzle's vector type passes it
  // through as a string like "[0.1,0.2,...]". Convert back to Float32Array
  // → bytes → base64 (legacy Job.embedding contract).
  const literal = typeof raw === 'string' ? raw : String(raw);
  const inner = literal.slice(1, -1);
  const parts = inner.split(',');
  const buf = Buffer.alloc(parts.length * 4);
  for (let i = 0; i < parts.length; i++) {
    buf.writeFloatLE(Number(parts[i]), i * 4);
  }
  return buf.toString('base64');
}

function jobToInsertRow(job: Job) {
  // Drizzle 0.45's vector column expects a `number[]`. Float32Array has
  // numeric index access but is NOT a number[] structurally for Drizzle's
  // encoder — explicit conversion required. Buffer view → Array.from.
  const buf = Buffer.from(job.embedding, 'base64');
  const fa = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    vertical: job.vertical,
    subVertical: job.subVertical ?? null,
    seniority: job.seniority,
    tier: job.tier ?? null,
    description: job.description,
    sourceUrl: job.sourceUrl,
    source: job.source,
    location: job.location,
    postedAt: new Date(job.postedAt),
    verifiedAt: new Date(job.verifiedAt),
    mustHaves: job.mustHaves ?? null,
    companyId: job.companyId ?? null,
    active: true,
    embedding: Array.from(fa),
  };
}

// ─── Repo implementation ──────────────────────────────────────────────────

async function getJob(id: string): Promise<Job | null> {
  const db = getDb();
  const rows = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  if (rows.length === 0) return null;
  return rowToJob(rows[0]!);
}

async function getJobBatch(ids: string[]): Promise<Job[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  const rows = await db.select().from(jobs).where(inArray(jobs.id, ids));
  return rows.map(rowToJob);
}

async function saveJob(job: Job): Promise<void> {
  const db = getDb();
  const row = jobToInsertRow(job);
  // Upsert by id — re-saving an existing job (refresh, re-ingest, taxonomy
  // re-classify) updates the live row in place.
  await db
    .insert(jobs)
    .values(row)
    .onConflictDoUpdate({
      target: jobs.id,
      set: {
        title: row.title,
        company: row.company,
        vertical: row.vertical,
        subVertical: row.subVertical,
        seniority: row.seniority,
        tier: row.tier,
        description: row.description,
        sourceUrl: row.sourceUrl,
        source: row.source,
        location: row.location,
        postedAt: row.postedAt,
        verifiedAt: row.verifiedAt,
        mustHaves: row.mustHaves,
        companyId: row.companyId,
        active: row.active,
        embedding: row.embedding,
      },
    });
}

async function expireJob(id: string): Promise<void> {
  const db = getDb();
  await db.update(jobs).set({ active: false }).where(eq(jobs.id, id));
}

async function isActiveJob(id: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ active: jobs.active })
    .from(jobs)
    .where(eq(jobs.id, id))
    .limit(1);
  return rows.length > 0 && rows[0]!.active === true;
}

async function listActiveIds(): Promise<string[]> {
  const db = getDb();
  const rows = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.active, true));
  return rows.map((r) => r.id);
}

async function touchVerifiedAt(id: string, iso: string): Promise<void> {
  const db = getDb();
  await db
    .update(jobs)
    .set({ verifiedAt: new Date(iso) })
    .where(eq(jobs.id, id));
}

async function topKByEmbedding(
  query: Float32Array,
  opts: TopKOpts,
): Promise<TopKResult[]> {
  const db = getDb();
  const queryLit = float32ToPgVector(query);

  // We build the WHERE clauses imperatively because Drizzle's sql tag
  // composition with optional fragments yields a cleaner plan than chained
  // .where() calls when mixing pgvector ops with relational filters.
  const wheres = [sql`active = true`];
  if (opts.vertical) wheres.push(sql`vertical = ${opts.vertical}`);
  if (opts.excludeIds && opts.excludeIds.length > 0) {
    // Inline each id as its own parameter. `id <> ALL($1::text[])` would be
    // cleaner but neon-http's array serialization is unreliable for the
    // ::text[] cast — params come through as a JSON-style array string.
    // Per-id placeholders are safe because each id is validated upstream
    // (JWT-derived or prior-result-set jobIds).
    const placeholders = opts.excludeIds.map((id) => sql`${id}`);
    wheres.push(sql`id NOT IN (${sql.join(placeholders, sql`, `)})`);
  }
  if (opts.excludeForUserId) {
    wheres.push(
      sql`NOT EXISTS (
        SELECT 1 FROM user_seen_job
        WHERE user_seen_job.user_id = ${opts.excludeForUserId}
          AND user_seen_job.job_id = jobs.id
      )`,
    );
  }

  // pgvector cosine distance is `<=>`; similarity = 1 - distance.
  const result = await db.execute(sql`
    SELECT id, 1 - (embedding <=> ${queryLit}::vector) AS score
    FROM jobs
    WHERE ${sql.join(wheres, sql` AND `)}
    ORDER BY embedding <=> ${queryLit}::vector
    LIMIT ${opts.k}
  `);

  // neon-http returns a NeonHttpQueryResult with .rows. Cast through unknown
  // because Drizzle types the rows as Record<string, unknown> generically;
  // our SELECT projection guarantees the id+score shape.
  const rawRows = (result as unknown as { rows?: Array<Record<string, unknown>> }).rows
    ?? (result as unknown as Array<Record<string, unknown>>);
  return rawRows.map((r) => ({
    id: String(r['id']),
    score: typeof r['score'] === 'string' ? Number(r['score']) : (r['score'] as number),
  }));
}

// ─── Module exports ────────────────────────────────────────────────────────

export const repoPostgres: JobsRepo = {
  getJob,
  getJobBatch,
  saveJob,
  expireJob,
  isActiveJob,
  listActiveIds,
  touchVerifiedAt,
  topKByEmbedding,
};

// Also export individual functions for callers that prefer named imports.
export {
  getJob,
  getJobBatch,
  saveJob,
  expireJob,
  isActiveJob,
  listActiveIds,
  touchVerifiedAt,
  topKByEmbedding,
};


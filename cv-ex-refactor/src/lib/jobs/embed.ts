// Gemini gemini-embedding-001 REST wrapper for CLI ingest.
// text-embedding-004 was deprecated; gemini-embedding-001 returns 3072-dim by default;
// we request 768 via outputDimensionality to keep the Job.embedding storage shape stable.
// Rate-limit: 5 req/s (free-tier headroom). Throws on any non-2xx response.
// NO HMAC cache here — that is a Phase 2 runtime concern.

const GEMINI_EMBED_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';
const EMBED_DIMS = 768;

const MAX_RPS = 5;
const WINDOW_MS = 1_000;
const TIMEOUT_MS = 30_000;

// Module-level token bucket — shared across all calls in the same process.
let inWindow = 0;
let windowStart = Date.now();

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resetWindowIfExpired(): void {
  const now = Date.now();
  if (now - windowStart >= WINDOW_MS) {
    inWindow = 0;
    windowStart = now;
  }
}

async function throttle(): Promise<void> {
  resetWindowIfExpired();
  if (inWindow >= MAX_RPS) {
    const wait = WINDOW_MS - (Date.now() - windowStart);
    if (wait > 0) await sleep(wait);
    // Reset after sleeping into next window
    inWindow = 0;
    windowStart = Date.now();
  }
  inWindow++;
}

/**
 * Embed `text` using Gemini gemini-embedding-001 REST API.
 * Returns a Float32Array of 768 dimensions (via outputDimensionality).
 * Throws with status + body excerpt on non-2xx.
 *
 * `externalSignal` lets the caller propagate a route-level deadline so embed
 * aborts before the outer maxDuration fires (and the inner 30s timeout still
 * applies as a safety net).
 */
export async function embedText(
  text: string,
  apiKey: string,
  externalSignal?: AbortSignal,
): Promise<Float32Array> {
  await throttle();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  let res: Response;
  try {
    res = await fetch(`${GEMINI_EMBED_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text }] },
        outputDimensionality: EMBED_DIMS,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (externalSignal?.aborted) {
      throw new Error('Gemini embed aborted by route deadline');
    }
    throw new Error(
      `Gemini embed request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
  }

  if (!res.ok) {
    // Read up to 500 chars of error body for diagnosis
    const body = await res.text().catch(() => '(unreadable)');
    throw new Error(
      `Gemini embed HTTP ${res.status}: ${body.slice(0, 500)}`,
    );
  }

  const json = (await res.json()) as { embedding?: { values?: number[] } };
  const values = json?.embedding?.values;

  if (!Array.isArray(values) || values.length !== EMBED_DIMS) {
    throw new Error(
      `Gemini embed unexpected response shape: got ${values?.length ?? 'undefined'} values`,
    );
  }

  // gemini-embedding-001 returns non-normalized vectors when outputDimensionality is set;
  // score.ts cosineSim treats embeddings as L2-normalized (dot == cosine), so normalize here.
  const vec = Float32Array.from(values);
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i]! * vec[i]!;
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) vec[i] = vec[i]! / norm;
  }
  return vec;
}

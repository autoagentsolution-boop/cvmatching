// Gemini text-embedding-004 REST wrapper for CLI ingest.
// Rate-limit: 5 req/s (free-tier headroom). Throws on any non-2xx response.
// NO HMAC cache here — that is a Phase 2 runtime concern.

const GEMINI_EMBED_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';

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
 * Embed `text` using Gemini text-embedding-004 REST API.
 * Returns a Float32Array of 768 dimensions.
 * Throws with status + body excerpt on non-2xx.
 */
export async function embedText(text: string, apiKey: string): Promise<Float32Array> {
  await throttle();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${GEMINI_EMBED_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: { parts: [{ text }] },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(
      `Gemini embed request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timer);
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

  if (!Array.isArray(values) || values.length !== 768) {
    throw new Error(
      `Gemini embed unexpected response shape: got ${values?.length ?? 'undefined'} values`,
    );
  }

  return Float32Array.from(values);
}

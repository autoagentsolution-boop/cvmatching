import { createHmac } from 'crypto';
import { kv, kvAvailable } from '@/lib/quota/kv-client';
import { env } from '@/lib/env';

const CACHE_TTL_SECONDS = 21600; // 6h

function getSecret(): string | null {
  return env.EMBED_CACHE_SECRET ?? null;
}

function cacheKey(cvText: string, secret: string): string {
  const hmac = createHmac('sha256', secret).update(cvText).digest('hex');
  return `embed-cache:${hmac}`;
}

function embToBase64(emb: Float32Array): string {
  return Buffer.from(emb.buffer, emb.byteOffset, emb.byteLength).toString('base64');
}

function base64ToEmb(b64: string): Float32Array {
  const buf = Buffer.from(b64, 'base64');
  // Buffer may not be 4-byte aligned from slice — copy into owned ArrayBuffer
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Float32Array(ab);
}

function assertSecretOrWarn(): string | null {
  const secret = getSecret();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('EMBED_CACHE_SECRET is required in production but not set');
    }
    console.warn('[embed-cache] EMBED_CACHE_SECRET not set — skipping cache in dev');
    return null;
  }
  return secret;
}

export async function getCachedEmbedding(cvText: string): Promise<Float32Array | null> {
  if (!kvAvailable) return null;

  const secret = assertSecretOrWarn();
  if (!secret) return null;

  try {
    const val = await kv.get<string>(cacheKey(cvText, secret));
    if (!val) return null;
    return base64ToEmb(val);
  } catch (e) {
    console.warn('[embed-cache] get_failed', {
      message: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export async function setCachedEmbedding(cvText: string, emb: Float32Array): Promise<void> {
  if (!kvAvailable) return;

  const secret = assertSecretOrWarn();
  if (!secret) return;

  try {
    await kv.set(cacheKey(cvText, secret), embToBase64(emb), { ex: CACHE_TTL_SECONDS });
  } catch (e) {
    console.warn('[embed-cache] set_failed', {
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

import { auth } from '@/auth';
import { env } from '@/lib/env';
import type { LlmConfigT } from '@/lib/schemas/llm-request';
import {
  consumeQuotaForUser,
  consumeQuotaForAnon,
  type QuotaAction,
} from '@/lib/quota/consume-quota';
import { getKey as getVaultKey } from '@/lib/byok-vault/store';

export type KeyResolution =
  | { ok: true; apiKey: string; byok: boolean; quotaRemaining: number | null; userId?: string }
  | { ok: false; status: number; code: string; message: string };

export interface ResolveContext {
  byokToken?: string | undefined;
  ip?: string | undefined;
}

export async function resolveApiKey(
  config: LlmConfigT,
  action: QuotaAction,
  ctx: ResolveContext = {},
): Promise<KeyResolution> {
  // 1) BYOK via vault cookie — opaque token → KV → decrypt
  if (ctx.byokToken) {
    const byokKey = await getVaultKey(ctx.byokToken);
    if (byokKey) {
      return { ok: true, apiKey: byokKey, byok: true, quotaRemaining: null };
    }
    // Token present but invalid/expired — fall through to shared path so the
    // user still works during pilot rather than getting a hard error.
  }

  if (env.DISABLE_SHARED_KEY === '1') {
    return {
      ok: false,
      status: 503,
      code: 'shared_key_disabled',
      message: 'Shared key tạm thời không khả dụng. Vui lòng dùng API key của bạn (BYOK) trong Settings.',
    };
  }

  // 2) Shared key — either signed-in user quota OR anonymous IP-based quota for pilot
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;

  let quotaResult;
  if (userId) {
    quotaResult = await consumeQuotaForUser(userId, action);
  } else {
    const ip = ctx.ip ?? 'unknown';
    quotaResult = await consumeQuotaForAnon(ip, action);
  }

  if (!quotaResult.ok) {
    return {
      ok: false,
      status: 429,
      code: 'quota_exceeded',
      message: quotaResult.reason ?? 'Hết quota hôm nay.',
    };
  }

  const shared =
    config.provider === 'gemini'
      ? env.GEMINI_API_KEY
      : config.provider === 'openai'
        ? env.OPENAI_API_KEY
        : undefined;

  if (!shared) {
    return {
      ok: false,
      status: 503,
      code: 'shared_key_disabled',
      message: 'Server chưa cấu hình shared key cho provider này. Vui lòng mở Settings (góc phải trên) và dán API key của bạn vào ô BYOK.',
    };
  }

  const result: KeyResolution = {
    ok: true,
    apiKey: shared,
    byok: false,
    quotaRemaining: quotaResult.remaining,
  };
  if (userId) result.userId = userId;
  return result;
}

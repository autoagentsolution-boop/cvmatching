import { auth } from '@/auth';
import { env } from '@/lib/env';
import type { LlmConfigT } from '@/lib/schemas/llm-request';
import { consumeQuotaForUser, type QuotaAction } from '@/lib/quota/consume-quota';

export type KeyResolution =
  | { ok: true; apiKey: string; byok: boolean; quotaRemaining: number | null; userId?: string }
  | { ok: false; status: number; code: string; message: string };

export async function resolveApiKey(
  config: LlmConfigT,
  action: QuotaAction,
): Promise<KeyResolution> {
  const byokKey = config.apiKey?.trim();
  if (byokKey) {
    return { ok: true, apiKey: byokKey, byok: true, quotaRemaining: null };
  }

  if (env.DISABLE_SHARED_KEY === '1') {
    return {
      ok: false,
      status: 503,
      code: 'shared_key_disabled',
      message: 'Shared key tạm thời không khả dụng. Vui lòng dùng API key của bạn (BYOK).',
    };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      status: 401,
      code: 'unauthorized',
      message: 'Vui lòng đăng nhập hoặc cấu hình API key (BYOK).',
    };
  }

  const quota = await consumeQuotaForUser(session.user.id, action);
  if (!quota.ok) {
    return {
      ok: false,
      status: 429,
      code: 'quota_exceeded',
      message: quota.reason ?? 'Hết quota hôm nay.',
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
      status: 500,
      code: 'llm_provider_error',
      message: 'Server chưa cấu hình shared key cho provider này.',
    };
  }

  return {
    ok: true,
    apiKey: shared,
    byok: false,
    quotaRemaining: quota.remaining,
    userId: session.user.id,
  };
}

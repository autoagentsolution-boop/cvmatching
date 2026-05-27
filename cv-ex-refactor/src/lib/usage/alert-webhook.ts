import { kv, kvAvailable } from '@/lib/quota/kv-client';
import { env } from '@/lib/env';
import { microUsdToString } from '@/lib/llm/model-prices';

interface AlertContext {
  ymd: string;
  sharedCallsToday: number;
  sharedCostMicroUsd: number;
}

interface Threshold {
  kind: 'calls' | 'cost';
  limit: number;
  current: number;
  message: string;
}

function parseNumber(input: string | undefined): number | null {
  if (!input) return null;
  const n = Number(input);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Fire alert to webhook if shared-key daily call count or daily cost crosses
 * the configured threshold. Dedup via KV SETNX so each threshold fires once
 * per UTC day. Fail-open: webhook errors only log, never throw.
 */
export async function maybeFireAlerts(ctx: AlertContext): Promise<void> {
  if (!env.ALERT_WEBHOOK_URL) return;
  if (!kvAvailable) return;

  const callsLimit = parseNumber(env.ALERT_SHARED_DAILY_CALLS);
  const costLimitUsd = parseNumber(env.ALERT_SHARED_DAILY_COST_USD);

  const crossed: Threshold[] = [];

  if (callsLimit && ctx.sharedCallsToday >= callsLimit) {
    crossed.push({
      kind: 'calls',
      limit: callsLimit,
      current: ctx.sharedCallsToday,
      message: `Shared-key calls today: ${ctx.sharedCallsToday} (threshold ${callsLimit})`,
    });
  }

  if (costLimitUsd && ctx.sharedCostMicroUsd >= costLimitUsd * 1_000_000) {
    crossed.push({
      kind: 'cost',
      limit: costLimitUsd,
      current: ctx.sharedCostMicroUsd,
      message: `Shared-key spend today: ${microUsdToString(ctx.sharedCostMicroUsd)} (threshold $${costLimitUsd})`,
    });
  }

  for (const t of crossed) {
    try {
      const flagKey = `alert:sent:${ctx.ymd}:${t.kind}`;
      const setResult = await kv.set(flagKey, '1', { nx: true, ex: 86400 });
      if (setResult !== 'OK') continue;

      await fireWebhook(env.ALERT_WEBHOOK_URL, t, ctx.ymd);
    } catch (e) {
      console.warn('[alert-webhook] dispatch_failed', {
        kind: t.kind,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

async function fireWebhook(url: string, t: Threshold, ymd: string): Promise<void> {
  const payload = {
    type: 'cv-ex-shared-key-threshold',
    severity: 'warning',
    date: ymd,
    threshold: t.kind,
    limit: t.limit,
    current: t.current,
    text: `:warning: ${t.message}`,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn('[alert-webhook] non_2xx', { status: res.status, kind: t.kind });
    }
  } finally {
    clearTimeout(timeout);
  }
}

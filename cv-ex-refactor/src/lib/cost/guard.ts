import { kv, kvAvailable } from '@/lib/quota/kv-client';
import { env } from '@/lib/env';
import { vnDateString } from '@/lib/quota/vn-date';
import { microUsdToString } from '@/lib/llm/model-prices';
import type { CostBucket } from './buckets';

export const WARN_LIMIT_MICRO_USD = 1_000_000; // $1
export const KILL_LIMIT_MICRO_USD = 3_000_000; // $3

function costKey(bucket: CostBucket, ymd: string): string {
  return `metrics:cost:${ymd}:${bucket}`;
}

function killSwitchKey(bucket: CostBucket): string {
  return `kill-switch:${bucket}`;
}

/** Read current day's cumulative cost (µUSD) + kill flag for each bucket. */
export async function readBucketStatus(
  buckets: readonly CostBucket[],
  ymd?: string,
): Promise<Array<{ bucket: CostBucket; cumulativeMicroUsd: number; killed: boolean }>> {
  if (!kvAvailable) {
    return buckets.map((b) => ({ bucket: b, cumulativeMicroUsd: 0, killed: false }));
  }
  const day = ymd ?? vnDateString();
  const costKeys = buckets.map((b) => costKey(b, day));
  const killKeys = buckets.map((b) => killSwitchKey(b));
  try {
    const [costs, kills] = await Promise.all([
      kv.mget<(string | number | null)[]>(...costKeys),
      kv.mget<(string | number | null)[]>(...killKeys),
    ]);
    return buckets.map((b, i) => ({
      bucket: b,
      cumulativeMicroUsd: Number(costs[i] ?? 0),
      killed: String(kills[i] ?? '') === '1',
    }));
  } catch {
    return buckets.map((b) => ({ bucket: b, cumulativeMicroUsd: 0, killed: false }));
  }
}

/** Whether alert webhook is configured. Returned to admin UI for safety badge. */
export function isAlertWebhookConfigured(): boolean {
  return Boolean(env.ALERT_WEBHOOK_URL);
}

function alertSentKey(kind: 'cost-warn' | 'cost-kill', bucket: CostBucket, ymd: string): string {
  return `alert:sent:${ymd}:${kind}:${bucket}`;
}

async function fireWebhook(
  url: string,
  severity: 'warning' | 'critical',
  bucket: CostBucket,
  cumulative: number,
  limitMicroUsd: number,
  ymd: string,
): Promise<void> {
  const label = severity === 'critical' ? 'KILL' : 'WARN';
  const payload = {
    type: 'cv-ex-cost-guard',
    severity,
    date: ymd,
    bucket,
    cumulative: microUsdToString(cumulative),
    limit: microUsdToString(limitMicroUsd),
    text: `:${severity === 'critical' ? 'rotating_light' : 'warning'}: [${label}] Cost bucket *${bucket}* hit ${microUsdToString(cumulative)} (limit ${microUsdToString(limitMicroUsd)})`,
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
      console.warn('[cost-guard] webhook_non_2xx', { status: res.status, bucket, severity });
    }
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Check if the kill-switch flag is set for a cost bucket.
 * Fail-open: KV errors are logged and treated as "not killed" to avoid blocking users.
 */
export async function checkKillSwitch(
  bucket: CostBucket,
): Promise<{ ok: boolean; reason?: string }> {
  if (!kvAvailable) return { ok: true };
  try {
    const val = await kv.get<string>(killSwitchKey(bucket));
    if (val === '1') return { ok: false, reason: 'cost-kill' };
    return { ok: true };
  } catch (e) {
    console.warn('[cost-guard] kill_switch_check_failed', {
      bucket,
      message: e instanceof Error ? e.message : String(e),
    });
    return { ok: true };
  }
}

/**
 * Record cost for a bucket and fire alerts if thresholds are crossed.
 * Sets a kill-switch KV flag at KILL_LIMIT and fires the alert webhook at WARN/KILL thresholds.
 * Fail-open: any KV error is logged and silently skipped.
 */
export async function recordCost(
  bucket: CostBucket,
  microUsd: number,
  ymd?: string,
): Promise<void> {
  if (!kvAvailable) return;

  const day = ymd ?? vnDateString();
  const key = costKey(bucket, day);

  try {
    const cumulative = await kv.incrby(key, microUsd);
    await kv.expire(key, 86400 * 2);

    if (cumulative >= KILL_LIMIT_MICRO_USD) {
      // Set kill-switch (24h TTL — operator must del manually to re-enable, see deployment.md).
      await kv.set(killSwitchKey(bucket), '1', { ex: 86400 });

      if (env.ALERT_WEBHOOK_URL) {
        const flagKey = alertSentKey('cost-kill', bucket, day);
        const setResult = await kv.set(flagKey, '1', { nx: true, ex: 86400 });
        if (setResult === 'OK') {
          await fireWebhook(env.ALERT_WEBHOOK_URL, 'critical', bucket, cumulative, KILL_LIMIT_MICRO_USD, day);
        }
      }
      return;
    }

    if (cumulative >= WARN_LIMIT_MICRO_USD && env.ALERT_WEBHOOK_URL) {
      const flagKey = alertSentKey('cost-warn', bucket, day);
      const setResult = await kv.set(flagKey, '1', { nx: true, ex: 86400 });
      if (setResult === 'OK') {
        await fireWebhook(env.ALERT_WEBHOOK_URL, 'warning', bucket, cumulative, WARN_LIMIT_MICRO_USD, day);
      }
    }
  } catch (e) {
    console.warn('[cost-guard] record_cost_failed', {
      bucket,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

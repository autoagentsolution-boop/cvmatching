// CLI to flip the per-bucket cost kill-switch flag in KV.
// Usage:
//   pnpm run kill-switch status
//   pnpm run kill-switch on  <bucket>
//   pnpm run kill-switch off <bucket>
//   pnpm run kill-switch on  --all
//
// Buckets: see COST_BUCKETS in src/lib/cost/buckets.ts (job-recommend, analyze,
//   career-path, career-path-suggest, generate-cv, extract-must-haves).
// When on, shared-key callers get 503 service_unavailable. BYOK callers are
// never blocked.
//
// Manual `on` sets the key WITHOUT TTL — admin override stays until explicit
// `off`. The auto path in recordCost() still sets a 24h TTL when daily cost
// breaches KILL_LIMIT; that's a separate flow. If both fire on the same
// bucket, manual `on` after auto-set extends to persistent.

import { kv, kvAvailable } from '../src/lib/quota/kv-client.js';
import { COST_BUCKETS, type CostBucket } from '../src/lib/cost/buckets.js';

function usage(): never {
  console.log(`
Usage:
  pnpm run kill-switch <command>

Commands:
  status                      Print state for every bucket
  on  <bucket>                Turn kill-switch ON for one bucket (persistent)
  off <bucket>                Turn kill-switch OFF for one bucket
  on  --all                   Turn ON for every bucket
  off --all                   Turn OFF for every bucket

Buckets: ${COST_BUCKETS.join(' | ')}
`);
  process.exit(1);
}

function isBucket(s: string): s is CostBucket {
  return (COST_BUCKETS as readonly string[]).includes(s);
}

function key(b: CostBucket): string {
  return `kill-switch:${b}`;
}

async function getStatus(b: CostBucket): Promise<boolean> {
  const v = await kv.get<unknown>(key(b));
  return v === '1' || v === 1;
}

async function setOn(b: CostBucket): Promise<void> {
  // No TTL — manual admin override persists until explicit `off`.
  await kv.set(key(b), '1');
}

async function setOff(b: CostBucket): Promise<void> {
  await kv.del(key(b));
}

async function main(): Promise<void> {
  if (!kvAvailable) {
    console.error('[kill-switch] KV not configured. Set KV_REST_API_URL + KV_REST_API_TOKEN.');
    process.exit(1);
  }

  const cmd = process.argv[2];
  const arg = process.argv[3];

  if (!cmd || cmd === '--help' || cmd === '-h') usage();

  if (cmd === 'status') {
    console.log('[kill-switch] Current state:');
    for (const b of COST_BUCKETS) {
      const on = await getStatus(b);
      console.log(`  ${b.padEnd(14)} ${on ? 'ON  (shared key BLOCKED)' : 'off (shared key allowed)'}`);
    }
    return;
  }

  if (cmd !== 'on' && cmd !== 'off') usage();
  if (!arg) usage();

  const buckets: CostBucket[] = arg === '--all' ? [...COST_BUCKETS] : isBucket(arg) ? [arg] : [];
  if (buckets.length === 0) {
    console.error(`[kill-switch] Unknown bucket: "${arg}". Valid: ${COST_BUCKETS.join(', ')}`);
    process.exit(1);
  }

  for (const b of buckets) {
    if (cmd === 'on') await setOn(b);
    else await setOff(b);
    console.log(`[kill-switch] ${b} → ${cmd === 'on' ? 'ON  (BLOCKED, persistent)' : 'off (allowed)'}`);
  }
}

main().catch((err) => {
  console.error('[kill-switch] FATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});

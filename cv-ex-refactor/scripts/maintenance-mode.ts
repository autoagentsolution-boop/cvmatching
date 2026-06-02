// CLI to toggle the site-wide maintenance flag in KV. When ON, proxy.ts
// returns a 503 maintenance HTML for every page navigation (API routes are
// excluded by the matcher; they're already gated by kill-switches + auth).
//
// Usage:
//   pnpm run maintenance status
//   pnpm run maintenance on
//   pnpm run maintenance off
//
// The flag has NO TTL — admin override persists until explicit `off`.

import { kv, kvAvailable } from '../src/lib/quota/kv-client.js';
import { MAINTENANCE_KEY } from '../src/lib/maintenance/maintenance-mode.js';

function usage(): never {
  console.log(`
Usage:
  pnpm run maintenance <command>

Commands:
  status       Print current maintenance flag state
  on           Enable maintenance (all page routes return 503)
  off          Disable maintenance (site returns to normal)
`);
  process.exit(1);
}

async function main(): Promise<void> {
  if (!kvAvailable) {
    console.error('[maintenance] KV not configured. Set KV_REST_API_URL + KV_REST_API_TOKEN.');
    process.exit(1);
  }

  const cmd = process.argv[2];
  if (!cmd || cmd === '--help' || cmd === '-h') usage();

  if (cmd === 'status') {
    const raw = await kv.get<unknown>(MAINTENANCE_KEY);
    const on = raw === '1' || raw === 1;
    console.log(`[maintenance] ${on ? 'ON  (site BLOCKED — proxy returns 503)' : 'off (site live)'}`);
    return;
  }

  if (cmd === 'on') {
    await kv.set(MAINTENANCE_KEY, '1');
    console.log('[maintenance] → ON  (proxy returns 503; bypass: /api/whoami, /api/health, /maintenance-ok)');
    console.log('[maintenance] NOTE: in-process 5s cache means existing instances take up to 5s to flip.');
    return;
  }

  if (cmd === 'off') {
    await kv.del(MAINTENANCE_KEY);
    console.log('[maintenance] → off (site live)');
    return;
  }

  usage();
}

main().catch((err) => {
  console.error('[maintenance] FATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});

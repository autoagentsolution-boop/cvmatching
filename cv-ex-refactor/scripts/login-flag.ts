// CLI to flip the public-login KV flag. Mirrors scripts/maintenance-mode.ts.
//
// Usage:
//   pnpm run login-flag status
//   pnpm run login-flag on
//   pnpm run login-flag off
//
// Set ON once after a fresh deploy so admins can sign in for the first time;
// flip OFF (or use the admin UI) once admins have a session cookie.

import { kv, kvAvailable } from '../src/lib/quota/kv-client.js';
import { LOGIN_FLAG_KEY } from '../src/lib/maintenance/login-flag.js';

function usage(): never {
  console.log(`
Usage:
  pnpm run login-flag <command>

Commands:
  status       Print current login flag state
  on           Enable public login (/sign-in reachable + topnav button visible)
  off          Disable public login (/sign-in returns 404; admin still bypasses)
`);
  process.exit(1);
}

async function main(): Promise<void> {
  if (!kvAvailable) {
    console.error('[login-flag] KV not configured.');
    process.exit(1);
  }

  const cmd = process.argv[2];
  if (!cmd || cmd === '--help' || cmd === '-h') usage();

  if (cmd === 'status') {
    const raw = await kv.get<unknown>(LOGIN_FLAG_KEY);
    const on = raw === '1' || raw === 1;
    console.log(`[login-flag] ${on ? 'ON  (public login OPEN)' : 'off (public login CLOSED)'}`);
    return;
  }
  if (cmd === 'on') {
    await kv.set(LOGIN_FLAG_KEY, '1');
    console.log('[login-flag] → ON  (public login open; /sign-in reachable; topnav button visible)');
    return;
  }
  if (cmd === 'off') {
    await kv.del(LOGIN_FLAG_KEY);
    console.log('[login-flag] → off (public login closed; /sign-in 404; admin bypass intact)');
    return;
  }
  usage();
}

main().catch((err) => {
  console.error('[login-flag] FATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});

// One-shot smoke test for the cost-alert webhook.
// Usage:
//   cd cv-ex-refactor
//   vercel env pull .env.production.local --environment=production
//   pnpm tsx scripts/test-cost-alert.ts
//   Remove-Item .env.production.local                 # cleanup prod creds on disk
//
// Why a dedicated .env.production.local: ALERT_WEBHOOK_URL is scoped to
// Preview+Production only, so a default `vercel env pull` (which targets
// development) won't include it. We also avoid overwriting .env.local
// because that would swap KV / Gemini creds in the dev shell.
//
// Fires a single fake WARN payload at ALERT_WEBHOOK_URL using the same
// adapter shape as guard.ts::fireWebhook (Pushover / CallMeBot / generic
// JSON POST). Does NOT touch KV — pure webhook reachability + credential
// validity check. Safe to re-run.
//
// Expected: admin device receives one push within ~5s with subject
// "[WARN-TEST] test-bucket". Recipient should ignore — it's a smoke ping.
//
// Exit 0 on 2xx response; non-zero with stderr message otherwise.

import { config } from 'dotenv';
// Load order: base .env / .env.local first, then prod-scoped overrides win.
config({ path: '.env' });
config({ path: '.env.local', override: true });
config({ path: '.env.production.local', override: true });

const url = process.env.ALERT_WEBHOOK_URL;
if (!url) {
  console.error(
    'FAIL: ALERT_WEBHOOK_URL not in env.\n' +
      '  Did you run `vercel env pull .env.production.local --environment=production`\n' +
      '  from cv-ex-refactor/ ? Default `vercel env pull` targets development scope\n' +
      '  and will miss this var (scoped to Preview+Production only).',
  );
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const text =
  `⚠️ [WARN-TEST] Cost bucket *test-bucket* hit $1.00 ` +
  `(limit $1.00) — ${today} [smoke test, ignore]`;

async function fire(): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    let label: string;
    let res: Response;

    if (/api\.pushover\.net/.test(url!)) {
      label = 'Pushover';
      const parsed = new URL(url!);
      const token = parsed.searchParams.get('token');
      const user = parsed.searchParams.get('user');
      if (!token || !user) {
        console.error('FAIL: Pushover URL missing token or user query param');
        process.exit(1);
      }
      const endpoint = `${parsed.origin}${parsed.pathname}`;
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          user,
          title: '[WARN-TEST] test-bucket',
          message: text,
          priority: 0,
        }),
        signal: controller.signal,
      });
    } else if (/api\.callmebot\.com\/whatsapp/.test(url!)) {
      label = 'CallMeBot';
      const sep = url!.includes('?') ? '&' : '?';
      res = await fetch(`${url}${sep}text=${encodeURIComponent(text)}`, {
        method: 'GET',
        signal: controller.signal,
      });
    } else {
      label = 'Generic JSON';
      res = await fetch(url!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'cv-ex-cost-guard-smoke',
          severity: 'warning',
          date: today,
          bucket: 'test-bucket',
          text,
        }),
        signal: controller.signal,
      });
    }

    const body = await res.text();
    if (res.ok) {
      console.log(`OK [${label}] ${res.status} — check device for push.`);
      console.log(`Body: ${body.slice(0, 200)}`);
    } else {
      console.error(`FAIL [${label}] ${res.status}`);
      console.error(body.slice(0, 500));
      process.exit(1);
    }
  } catch (e) {
    console.error(`FAIL: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  } finally {
    clearTimeout(timeout);
  }
}

void fire();

// One-shot pool seed/refresh script.
// Runs the full ingest sweep across all enabled sources in sequence,
// prints pre/post stats, ends with the 21-day expire pass.
//
// Usage:
//   pnpm run seed-pool                      — full sweep, defaults (3 pages, ≤3d freshness)
//   pnpm run seed-pool -- --pages 2
//   pnpm run seed-pool -- --max-age-days 5
//   pnpm run seed-pool -- --skip-itviec
//
// Each sub-command runs in its own child process so a single source's
// failure (Cloudflare flap, partial timeout, etc.) doesn't kill the
// whole sweep. Total wall-clock for full run: ~25-40 min depending on yield.
//
// Designed for: (1) operator manual run, (2) Windows Task Scheduler /
// macOS launchd / cron, (3) optional GH Actions wrapper. Same script
// drives all three — single source of truth.

import { spawn } from 'node:child_process';

interface Args {
  pages: string;
  maxAgeDays: string;
  skipTopcv: boolean;
  skipItviec: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    pages: '3',
    maxAgeDays: '3',
    skipTopcv: false,
    skipItviec: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--pages') out.pages = argv[++i] ?? '3';
    else if (a === '--max-age-days') out.maxAgeDays = argv[++i] ?? '3';
    else if (a === '--skip-topcv') out.skipTopcv = true;
    else if (a === '--skip-itviec') out.skipItviec = true;
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: pnpm run seed-pool [-- --pages N] [--max-age-days N]\n' +
          '                         [--skip-topcv] [--skip-itviec]\n' +
          '\n' +
          'Runs: pre-stats → TopCV tech sweep → TopCV non-tech sweep →\n' +
          '      ITviec tech sweep → expire pass → post-stats.\n' +
          '\n' +
          'Each step runs in its own child process; one failure does not\n' +
          'abort the sweep.',
      );
      process.exit(0);
    }
  }
  return out;
}

// Slug groups — keep synced with taxonomy.SOURCES.topcv / SOURCES.vl24h /
// SOURCES.itviec. All verified live 2026-06-07.
const TOPCV_TECH = [
  'tim-viec-lam-lap-trinh-vien',
  'tim-viec-lam-it-phan-mem',
  'tim-viec-lam-backend-developer',
  'tim-viec-lam-frontend-developer',
  'tim-viec-lam-mobile-developer',
  'tim-viec-lam-devops',
  'tim-viec-lam-data-engineer',
  'tim-viec-lam-data-analyst',
  'tim-viec-lam-tester',
  'tim-viec-lam-qa-qc',
  'tim-viec-lam-java',
  'tim-viec-lam-nodejs',
  'tim-viec-lam-reactjs',
  'tim-viec-lam-python',
  'tim-viec-lam-ios',
];

const TOPCV_NONTECH = [
  'tim-viec-lam-ke-toan',
  'tim-viec-lam-marketing',
  'tim-viec-lam-nhan-vien-kinh-doanh',
  'tim-viec-lam-hanh-chinh-nhan-su',
  'tim-viec-lam-ngan-hang',
];

const ITVIEC_TECH = [
  'data-engineer',
  'senior-data-engineer',
  'backend-developer',
  'frontend-developer',
  'devops',
];

function banner(label: string): void {
  const line = '─'.repeat(60);
  console.log(`\n${line}\n  ${label}\n${line}`);
}

// Spawn `pnpm run ingest <cmd> [args...]` as a child process. Returns the
// exit code (0 = success). Does NOT throw on non-zero exit so the outer
// sweep can continue.
function runIngest(args: string[], extraEnv: Record<string, string> = {}): Promise<number> {
  return new Promise((resolve) => {
    // shell: true on Windows — Node 20.12.2+ refuses to spawn .cmd shims
    // (CVE-2024-27980 mitigation) without shell mode, surfacing as EINVAL.
    // All args here are hardcoded (slug names + flags, no spaces / no user
    // input), so command-injection surface is nil.
    const isWin = process.platform === 'win32';
    const child = spawn(
      isWin ? 'pnpm.cmd' : 'pnpm',
      ['run', 'ingest', ...args],
      {
        stdio: 'inherit',
        env: { ...process.env, ...extraEnv },
        shell: isWin,
      },
    );
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', (err) => {
      console.error(`[seed-pool] spawn error: ${err.message}`);
      resolve(1);
    });
  });
}

async function step(label: string, args: string[], extraEnv: Record<string, string> = {}): Promise<void> {
  banner(label);
  const t0 = Date.now();
  const code = await runIngest(args, extraEnv);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (code === 0) {
    console.log(`✓ ${label} done in ${secs}s`);
  } else {
    console.warn(`⚠ ${label} exited with code ${code} after ${secs}s — continuing.`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  // Propagate freshness cap to the URL-detail step (read by ingest-urls.ts).
  const extra = { INGEST_MAX_AGE_DAYS: args.maxAgeDays };

  const t0 = Date.now();
  banner('Pool seed / refresh');
  console.log(`  pages=${args.pages}  max-age-days=${args.maxAgeDays}`);
  console.log(`  topcv.tech=${TOPCV_TECH.length} slugs`);
  console.log(`  topcv.nontech=${TOPCV_NONTECH.length} slugs`);
  console.log(`  itviec=${ITVIEC_TECH.length} slugs`);

  await step('Pre-refresh stats', ['stats']);

  if (!args.skipTopcv) {
    await step(
      'TopCV tech sweep',
      ['topcv', ...TOPCV_TECH, '--pages', args.pages],
      extra,
    );
    await step(
      'TopCV non-tech sweep',
      ['topcv', ...TOPCV_NONTECH, '--pages', args.pages],
      extra,
    );
  }

  if (!args.skipItviec) {
    await step(
      'ITviec tech sweep',
      ['itviec', ...ITVIEC_TECH, '--pages', args.pages],
      extra,
    );
  }

  await step('Expire pass (verifiedAt > 21d → inactive)', ['expire']);
  await step('Post-refresh stats', ['stats']);

  const totalMin = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  banner(`Done — total ${totalMin} min`);
}

main().catch((err) => {
  console.error('[seed-pool] Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});

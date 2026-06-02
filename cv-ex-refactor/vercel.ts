// Vercel project configuration (TypeScript).
// Requires: pnpm add -D @vercel/config (installed Phase 4).
// Vercel CLI + dashboard pick this up automatically at build time.
//
// Cron schedule: 0 20 * * * = 20:00 UTC = 03:00 ICT (daily).
// Single tick — Vercel Pro maxDuration=300s accommodates full 150-job batch
// (~150 × 2s = ~5 min, with 30s safety margin via deadline check in refresh-batch).
// If downgraded to Hobby (maxDuration=60s): reduce to 25 jobs/tick × 6 schedules/day.

import { type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'nextjs',
  crons: [
    {
      path: '/api/jobs/refresh',
      schedule: '0 20 * * *', // 20:00 UTC = 03:00 ICT
    },
  ],
};

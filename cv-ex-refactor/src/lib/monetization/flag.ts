// Single source of truth for whether SePay monetization is live.
//
// Default: OFF. Operator must set MONETIZATION_ENABLED=1 (or =true) to enable.
// Why default-off: pricing plan isn't finalized; we don't want /upgrade or
// the webhook to be reachable in the meantime. Earlier draft defaulted to
// on; flipped 2026-06-06 per product.
//
// Used by:
//   - /upgrade page         → redirect away when off
//   - /api/checkout/sepay   → 503 when off
//   - /api/webhooks/sepay   → 503 when off
//   - nav UpgradeLink       → don't render when off
//   - resolveUserTier       → returns 'paid' for any signed-in user when off,
//                              so they're not stuck at the 2-job free cap
//                              without any way to upgrade.

import { env } from '@/lib/env';

export function isMonetizationEnabled(): boolean {
  const flag = env.MONETIZATION_ENABLED;
  return flag === '1' || flag === 'true';
}

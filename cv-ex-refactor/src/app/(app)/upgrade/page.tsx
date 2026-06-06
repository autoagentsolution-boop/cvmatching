import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { getSession } from '@/lib/get-session';
import { resolveUserTier } from '@/lib/users/resolve-user-tier';
import { UpgradeClient } from './upgrade-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function UpgradePage() {
  if (env.MONETIZATION_ENABLED === '0' || env.MONETIZATION_ENABLED === 'false') {
    redirect('/job-fit');
  }

  const session = await getSession();
  if (!session?.user?.id) redirect('/sign-in?next=/upgrade');

  const tier = await resolveUserTier(session);
  if (tier === 'paid') redirect('/job-fit?msg=already-pro');

  const priceVnd = (() => {
    const raw = env.PAID_PLAN_PRICE_VND;
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 99_000;
  })();

  return <UpgradeClient priceVnd={priceVnd} userEmail={session.user.email ?? null} />;
}

import Link from 'next/link';
import { isMonetizationEnabled } from '@/lib/monetization/flag';
import { resolveUserTier } from '@/lib/users/resolve-user-tier';
import type { Session } from 'next-auth';

// Server component — runs in layout. Shows "Upgrade to Pro" pill only when:
//   - monetization is on
//   - user is signed in
//   - user's current tier is 'free'
// Hidden for anon (CTA is sign-in, not upgrade) and paid (already there).
export async function UpgradeLink({ session }: { session: Session | null }) {
  if (!isMonetizationEnabled()) return null;
  if (!session?.user?.id) return null;

  const tier = await resolveUserTier(session);
  if (tier !== 'free') return null;

  return (
    <Link
      href="/upgrade"
      className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-label-sm font-medium text-on-primary transition hover:opacity-90"
    >
      Upgrade to Pro
    </Link>
  );
}

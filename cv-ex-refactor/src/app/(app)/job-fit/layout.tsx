import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/get-session';
import { isAdminUser } from '@/lib/usage/admin-auth';
import { isJobFitEnabled } from '@/lib/maintenance/job-fit-flag';

/**
 * Gate the /job-fit/* subtree to admin testers while the 150-job pilot KV
 * seed is being shaken down. Non-admins get a 404 to hide the route's
 * existence rather than 403, matching the /admin/* pattern.
 *
 * 2026-06-10: also honour the admin Site Controls kill-switch. When the
 * flag is off, EVERYONE (admin included) gets 404 so the off state is
 * directly testable from the admin's session.
 */
export default async function JobFitLayout({ children }: { children: ReactNode }) {
  const session = await getSession().catch(() => null);
  const jobFitOn = await isJobFitEnabled();
  if (!jobFitOn) notFound();
  if (!isAdminUser(session?.user)) notFound();
  return <>{children}</>;
}

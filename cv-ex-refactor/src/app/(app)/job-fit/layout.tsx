import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/get-session';
import { isAdminId } from '@/lib/usage/admin-auth';

/**
 * Gate the /job-fit/* subtree to admin testers while the 150-job pilot KV
 * seed is being shaken down. Non-admins get a 404 to hide the route's
 * existence rather than 403, matching the /admin/* pattern.
 */
export default async function JobFitLayout({ children }: { children: ReactNode }) {
  const session = await getSession().catch(() => null);
  if (!isAdminId(session?.user?.id)) {
    notFound();
  }
  return <>{children}</>;
}

import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/get-session';
import { isAdminUser } from '@/lib/usage/admin-auth';

/**
 * Gate the entire /admin/* subtree. Non-admins (including signed-out users)
 * get a 404 to hide the route's existence rather than a 403 that confirms it.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!isAdminUser(session?.user)) {
    notFound();
  }
  return <>{children}</>;
}

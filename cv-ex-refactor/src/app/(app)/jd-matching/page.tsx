import { redirect } from 'next/navigation';
import { getSession } from '@/lib/get-session';
import { getDefaultCvId } from '@/lib/cvs/get-default-cv-id';

/**
 * Legacy /jd-matching route — redirects to new workflow shell.
 * DO NOT delete — Phase 6 removes this after full content migration.
 */
export default async function JdMatchingRedirectPage() {
  let session = null;
  try {
    session = await getSession();
  } catch {
    // dev — no auth configured
  }

  if (!session?.user?.id) redirect('/sign-in');

  const defaultCvId = await getDefaultCvId(session.user.id);
  if (!defaultCvId) redirect('/dashboard');

  redirect(`/jd-matching/${defaultCvId}/match`);
}

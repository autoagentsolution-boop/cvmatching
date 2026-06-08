import { redirect } from 'next/navigation';
import { getSession } from '@/lib/get-session';
import { getDefaultCvId } from '@/lib/cvs/get-default-cv-id';

/**
 * Legacy /analyze route — redirects to new workflow shell.
 * Authed users with a default CV go to /cv-analyze/[id]/score.
 * Users without a CV go to /dashboard to be prompted.
 * Guests redirect to /sign-in.
 *
 * DO NOT delete — Phase 6 removes this after full content migration.
 */
export default async function AnalyzeRedirectPage() {
  let session = null;
  try {
    session = await getSession();
  } catch {
    // dev — no auth configured
  }

  if (!session?.user?.id) redirect('/sign-in');

  const defaultCvId = await getDefaultCvId(session.user.id);
  if (!defaultCvId) redirect('/dashboard');

  redirect(`/cv-analyze/${defaultCvId}/score`);
}

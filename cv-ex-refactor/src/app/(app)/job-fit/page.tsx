import { redirect } from 'next/navigation';
import { getSession } from '@/lib/get-session';
import { getDefaultCvId } from '@/lib/cvs/get-default-cv-id';

/**
 * Legacy /job-fit route — redirects to /cv-analyze/[id]/jobfit.
 * The layout.tsx admin gate still applies for the /job-fit subtree.
 * DO NOT delete — Phase 6 removes this after full content migration.
 */
export default async function JobFitRedirectPage() {
  let session = null;
  try {
    session = await getSession();
  } catch {
    // dev — no auth configured
  }

  if (!session?.user?.id) redirect('/sign-in');

  const defaultCvId = await getDefaultCvId(session.user.id);
  if (!defaultCvId) redirect('/dashboard');

  redirect(`/cv-analyze/${defaultCvId}/jobfit`);
}

import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/get-session';
import { loadUserCv, loadUserCvList } from '@/lib/cvs/load-user-cv';
import { isAdminUser } from '@/lib/usage/admin-auth';
import { WorkflowLayout } from '@/components/layouts/workflow-layout';
import { JdMatchingSourceArea } from '@/features/jd-matching/jd-matching-source-area';
import { isJobFitEnabled } from '@/lib/maintenance/job-fit-flag';

// Layout-level shell for the JD Matching workflow. Owns the persistent
// Source CV iframe across chevron step navigation. JdMatchingSourceArea
// is a client component that further decides — based on the URL step
// segment — whether to render CV + JD side-by-side (/match) or CV-only
// (/refined, /roadmap, /jobfit). The sourceLayout function form mirrors
// that decision so the placement (top row vs left column) tracks the
// content shape.

export default async function JdMatchingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ cvId: string }>;
}) {
  const { cvId } = await params;

  const session = await getSession();
  if (!session?.user?.id) redirect('/sign-in');

  const cv = await loadUserCv(session.user.id, cvId);
  if (!cv) notFound();

  const cvs = await loadUserCvList(session.user.id);
  const isAdmin = isAdminUser(session.user);
  const jobFitOn = await isJobFitEnabled();

  return (
    <WorkflowLayout
      workflow="jd-matching"
      currentCvId={cvId}
      cvs={cvs}
      sourceDocuments={
        <JdMatchingSourceArea
          cvContent={cv.content}
          cvId={cvId}
          cvOriginalMime={cv.originalMime}
        />
      }
      isAdmin={isAdmin}
      jobFitEnabled={jobFitOn}
      isAuthed
    >
      {children}
    </WorkflowLayout>
  );
}

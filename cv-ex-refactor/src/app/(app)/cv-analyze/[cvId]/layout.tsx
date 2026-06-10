import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/get-session';
import { loadUserCv, loadUserCvList } from '@/lib/cvs/load-user-cv';
import { isAdminUser } from '@/lib/usage/admin-auth';
import { WorkflowLayout } from '@/components/layouts/workflow-layout';
import { SourceDocumentCard } from '@/components/ui/source-document-card';
import { isJobFitEnabled } from '@/lib/maintenance/job-fit-flag';

// Owning the WorkflowLayout at the [cvId] segment is what keeps the
// SourceDocumentCard iframe mounted across chevron step navigation.
// /cv-analyze/[id]/score → /cv-analyze/[id]/refined no longer unmounts
// the PDF viewer; only the right-column step content re-renders.
// The layout DOES re-mount when [cvId] itself changes — which matches the
// user requirement that the source preview only reloads on CV switch.

export default async function CvAnalyzeLayout({
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

  const sourceDocuments = (
    <SourceDocumentCard
      content={cv.content}
      kind="cv"
      className="h-full min-h-[400px]"
      originalUrl={`/api/cvs/${cvId}/original`}
      {...(cv.originalMime ? { originalMime: cv.originalMime } : {})}
    />
  );

  return (
    <WorkflowLayout
      workflow="cv-analyze"
      currentCvId={cvId}
      cvs={cvs}
      sourceDocuments={sourceDocuments}
      isAdmin={isAdmin}
      jobFitEnabled={jobFitOn}
      isAuthed
    >
      {children}
    </WorkflowLayout>
  );
}

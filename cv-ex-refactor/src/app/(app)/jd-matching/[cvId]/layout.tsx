import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/get-session';
import { loadUserCv, loadUserCvList } from '@/lib/cvs/load-user-cv';
import { isAdminUser } from '@/lib/usage/admin-auth';
import { WorkflowLayout } from '@/components/layouts/workflow-layout';
import { SourceDocumentCard } from '@/components/ui/source-document-card';

// Mirror of cv-analyze/[cvId]/layout.tsx — owning the WorkflowLayout here
// keeps the source CV iframe mounted across chevron step navigation.
// JD viewer remains in-page (driven by client state), so only the CV side
// of the dual-source pane benefits from persistence today; the empty-JD
// card re-renders cheaply.

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

  const sourceDocuments = (
    <div className="flex flex-col gap-3">
      <SourceDocumentCard
        content={cv.content}
        kind="cv"
        defaultZoom={0.75}
        originalUrl={`/api/cvs/${cvId}/original`}
        {...(cv.originalMime ? { originalMime: cv.originalMime } : {})}
      />
      <SourceDocumentCard
        content=""
        kind="jd"
        defaultZoom={0.75}
        emptyHint={
          <p className="text-[11px] text-on-surface-variant/70">
            Upload PDF/Word or paste a job posting URL.
          </p>
        }
      />
    </div>
  );

  return (
    <WorkflowLayout
      workflow="jd-matching"
      currentCvId={cvId}
      cvs={cvs}
      sourceDocuments={sourceDocuments}
      isAdmin={isAdmin}
      isAuthed
    >
      {children}
    </WorkflowLayout>
  );
}

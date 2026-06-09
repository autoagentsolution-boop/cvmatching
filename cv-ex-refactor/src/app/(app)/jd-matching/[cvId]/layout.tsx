import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/get-session';
import { loadUserCv, loadUserCvList } from '@/lib/cvs/load-user-cv';
import { isAdminUser } from '@/lib/usage/admin-auth';
import { WorkflowLayout } from '@/components/layouts/workflow-layout';
import { SourceDocumentCard } from '@/components/ui/source-document-card';
import { JdSourceCard } from '@/features/jd-matching/jd-source-card';

// Mirror of cv-analyze/[cvId]/layout.tsx — owning the WorkflowLayout here
// keeps the source CV iframe mounted across chevron step navigation.
// JD lives in the analysis store (client state) so JdSourceCard renders
// it live as the user imports via paste/URL/file in the right pane.

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

  // id anchors let scrollToSource() jump here from a finding row.
  const sourceDocuments = (
    <div className="grid gap-3 lg:grid-cols-2">
      <div id="source-cv-card" className="scroll-mt-20">
        <SourceDocumentCard
          content={cv.content}
          kind="cv"
          defaultZoom={0.75}
          originalUrl={`/api/cvs/${cvId}/original`}
          {...(cv.originalMime ? { originalMime: cv.originalMime } : {})}
        />
      </div>
      <div id="source-jd-card" className="scroll-mt-20">
        <JdSourceCard />
      </div>
    </div>
  );

  return (
    <WorkflowLayout
      workflow="jd-matching"
      currentCvId={cvId}
      cvs={cvs}
      sourceDocuments={sourceDocuments}
      sourceLayout="top"
      isAdmin={isAdmin}
      isAuthed
    >
      {children}
    </WorkflowLayout>
  );
}

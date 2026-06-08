import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getSession } from '@/lib/get-session';
import { getUserCv, listUserCvs } from '@/lib/cvs/repo';
import { isAdminUser } from '@/lib/usage/admin-auth';
import { WorkflowLayout } from '@/components/layouts/workflow-layout';
import { SourceDocumentCard } from '@/components/ui/source-document-card';
import { JdMatchingContent } from '@/features/jd-matching/jd-matching-content';
import { RefinedCvPage } from '@/features/refined-cv/refined-cv-page';
import { CareerPathPage } from '@/features/career-path/career-path-page';
import { JobFitListPage } from '@/features/job-fit/job-fit-list-page';

const VALID_STEPS = ['match', 'refined', 'roadmap', 'jobfit'] as const;
type JdMatchingStep = (typeof VALID_STEPS)[number];

function isValidStep(step: string): step is JdMatchingStep {
  return (VALID_STEPS as readonly string[]).includes(step);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cvId: string; step: string }>;
}): Promise<Metadata> {
  const { step } = await params;
  const labels: Record<string, string> = {
    match: 'JD Matching',
    refined: 'Refined CV',
    roadmap: 'Roadmap',
    jobfit: 'Job Fit',
  };
  return { title: `${labels[step] ?? 'JD Matching'} — Resume Refactor` };
}

export default async function JdMatchingStepPage({
  params,
}: {
  params: Promise<{ cvId: string; step: string }>;
}) {
  const { cvId, step } = await params;

  if (!isValidStep(step)) notFound();

  const session = await getSession();
  if (!session?.user?.id) redirect('/sign-in');

  const cv = await getUserCv(session.user.id, cvId);
  if (!cv) notFound();

  const cvs = await listUserCvs(session.user.id);
  const isAdmin = isAdminUser(session.user);

  // JD content lives in client state during JD Matching — Phase 5 will wire
  // import flow. For now we render an empty Source JD card so users can see the
  // import affordance.
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
      currentStepId={step}
      cvs={cvs}
      sourceDocuments={sourceDocuments}
      isAdmin={isAdmin}
      isAuthed
    >
      <StepContent step={step} cvContent={cv.content} cvId={cvId} />
    </WorkflowLayout>
  );
}

function StepContent({ step, cvContent, cvId }: { step: JdMatchingStep; cvContent: string; cvId: string }) {
  switch (step) {
    case 'match':
      return <JdMatchingContent cvContent={cvContent} cvId={cvId} />;
    case 'refined':
      return <RefinedCvPage mode="jd-context" />;
    case 'roadmap':
      return (
        <Suspense fallback={null}>
          <CareerPathPage mode="jd-context" />
        </Suspense>
      );
    case 'jobfit':
      return <JobFitListPage mode="jd-context" />;
  }
}

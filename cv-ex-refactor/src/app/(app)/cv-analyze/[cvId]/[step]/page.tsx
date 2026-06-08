import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getSession } from '@/lib/get-session';
import { getUserCv, listUserCvs } from '@/lib/cvs/repo';
import { isAdminUser } from '@/lib/usage/admin-auth';
import { WorkflowLayout } from '@/components/layouts/workflow-layout';
import { SourceDocumentCard } from '@/components/ui/source-document-card';
import { CvAnalyzeContent } from '@/features/cv-analyze/cv-analyze-content';
import { RefinedCvPage } from '@/features/refined-cv/refined-cv-page';
import { CareerPathPage } from '@/features/career-path/career-path-page';
import { JobFitListPage } from '@/features/job-fit/job-fit-list-page';

const VALID_STEPS = ['score', 'refined', 'roadmap', 'jobfit'] as const;
type CvAnalyzeStep = (typeof VALID_STEPS)[number];

function isValidStep(step: string): step is CvAnalyzeStep {
  return (VALID_STEPS as readonly string[]).includes(step);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cvId: string; step: string }>;
}): Promise<Metadata> {
  const { step } = await params;
  const labels: Record<string, string> = {
    score: 'CV Analyze',
    refined: 'Refined CV',
    roadmap: 'Roadmap',
    jobfit: 'Job Fit',
  };
  return { title: `${labels[step] ?? 'CV Analyze'} — Resume Refactor` };
}

export default async function CvAnalyzeStepPage({
  params,
}: {
  params: Promise<{ cvId: string; step: string }>;
}) {
  const { cvId, step } = await params;

  // Validate step param
  if (!isValidStep(step)) notFound();

  // Auth gate
  const session = await getSession();
  if (!session?.user?.id) redirect('/sign-in');

  // Ownership check — returns null on missing OR wrong user (no info leak)
  const cv = await getUserCv(session.user.id, cvId);
  if (!cv) notFound();

  // Fetch all CVs for the picker
  const cvs = await listUserCvs(session.user.id);
  const isAdmin = isAdminUser(session.user);

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

function StepContent({ step, cvContent, cvId }: { step: CvAnalyzeStep; cvContent: string; cvId: string }) {
  switch (step) {
    case 'score':
      return <CvAnalyzeContent cvContent={cvContent} cvId={cvId} />;
    case 'refined':
      return <RefinedCvPage mode="cv-solo" />;
    case 'roadmap':
      return (
        <Suspense fallback={null}>
          <CareerPathPage mode="cv-solo" />
        </Suspense>
      );
    case 'jobfit':
      return <JobFitListPage mode="cv-solo" />;
  }
}

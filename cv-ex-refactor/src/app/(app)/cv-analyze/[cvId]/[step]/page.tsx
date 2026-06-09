import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getSession } from '@/lib/get-session';
import { loadUserCv } from '@/lib/cvs/load-user-cv';
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

  if (!isValidStep(step)) notFound();

  // Auth + ownership are re-checked here even though the parent layout
  // already validated, because page.tsx runs in its own RSC context and
  // we still need cv.content for the 'score' step. loadUserCv() is wrapped
  // in React cache() so this is a dedup-hit, not a second DB query.
  const session = await getSession();
  if (!session?.user?.id) redirect('/sign-in');
  const cv = await loadUserCv(session.user.id, cvId);
  if (!cv) notFound();

  return <StepContent step={step} cvContent={cv.content} cvId={cvId} cvName={cv.name} />;
}

function StepContent({
  step,
  cvContent,
  cvId,
  cvName,
}: {
  step: CvAnalyzeStep;
  cvContent: string;
  cvId: string;
  cvName: string;
}) {
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
      return <JobFitListPage mode="cv-solo" cvText={cvContent} cvName={cvName} />;
  }
}

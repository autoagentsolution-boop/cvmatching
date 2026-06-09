import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getSession } from '@/lib/get-session';
import { loadUserCv } from '@/lib/cvs/load-user-cv';
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
  const cv = await loadUserCv(session.user.id, cvId);
  if (!cv) notFound();

  return <StepContent step={step} cvContent={cv.content} cvId={cvId} />;
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

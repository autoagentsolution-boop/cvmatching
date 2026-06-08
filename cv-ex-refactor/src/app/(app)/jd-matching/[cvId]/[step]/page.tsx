import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getSession } from '@/lib/get-session';
import { getUserCv, listUserCvs } from '@/lib/cvs/repo';
import { isAdminUser } from '@/lib/usage/admin-auth';
import { WorkflowLayout } from '@/components/layouts/workflow-layout';
import { JdMatchingPage } from '@/features/analyze/jd-matching-page';
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

  // Source documents: CV + JD placeholder (JD panel is Phase 3/5 territory)
  const sourceDocPlaceholder = (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-dashed border-outline-variant p-4 text-body-sm text-on-surface-variant">
        <p className="font-semibold text-on-surface mb-1 text-[10px] uppercase tracking-widest">
          Source CV
        </p>
        <p className="line-clamp-5 text-[12px] leading-relaxed whitespace-pre-wrap">
          {cv.content.slice(0, 300)}
          {cv.content.length > 300 ? '…' : ''}
        </p>
      </div>
      <div className="rounded-xl border border-dashed border-outline-variant p-4 text-body-sm text-on-surface-variant">
        <p className="font-semibold text-on-surface mb-1 text-[10px] uppercase tracking-widest">
          Source JD
        </p>
        <p className="text-[12px] text-on-surface-variant/70">
          Paste or import a job description — Phase 3
        </p>
      </div>
    </div>
  );

  return (
    <WorkflowLayout
      workflow="jd-matching"
      currentCvId={cvId}
      currentStepId={step}
      cvs={cvs}
      sourceDocuments={sourceDocPlaceholder}
      isAdmin={isAdmin}
      isAuthed
    >
      <StepContent step={step} />
    </WorkflowLayout>
  );
}

function StepContent({ step }: { step: JdMatchingStep }) {
  switch (step) {
    case 'match':
      return <JdMatchingPage />;
    case 'refined':
      return <RefinedCvPage />;
    case 'roadmap':
      return (
        <Suspense fallback={null}>
          <CareerPathPage />
        </Suspense>
      );
    case 'jobfit':
      return <JobFitListPage />;
  }
}

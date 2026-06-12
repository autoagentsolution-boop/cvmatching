// Interview results — server component, read-only render of the completed
// session. Renders DualLens + 10 graded question cards (rubric preserved
// because the API returns it for completed sessions; storage delivers the
// raw row to the server here).

import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { getSession } from '@/lib/get-session';
import { getSessionById } from '@/lib/interview/storage';
import { getJob } from '@/lib/jobs/repo-postgres';
import { isInterviewEnabled } from '@/lib/maintenance/interview-flag';
import { DualLensCard } from '@/features/interview/dual-lens-card';
import { QuestionCard } from '@/features/interview/question-card';
import { ResultsSummary } from '@/features/interview/results-summary';
import { StudyPlanCard } from '@/features/interview/study-plan-card';
import { GenerateStudyPlanButton } from '@/features/interview/generate-study-plan-button';
import { PageHeader } from '@/components/ui/page-header';
import type { InterviewGrade } from '@/lib/llm/schemas-interview';

export const metadata: Metadata = { title: 'Interview results — Resume Refactor' };

export const preferredRegion = 'sin1';

interface GradedQuestion {
  id: string;
  type: 'behavioral' | 'technical' | 'scenario';
  question: string;
  rubric?: unknown;
  user_answer?: string;
  grade?: InterviewGrade;
}

export default async function InterviewResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isInterviewEnabled())) notFound();

  const session = await getSession();
  if (!session?.user?.id) redirect('/sign-in');
  const { id } = await params;

  const persisted = await getSessionById(id, session.user.id);
  if (!persisted) notFound();

  // If a user nav'd to /results before completing, redirect back. Defensive
  // — UI wouldn't normally route here for in_progress.
  if (persisted.status !== 'completed') {
    redirect(`/interview/${id}`);
  }

  const overallScore = persisted.overallScore == null ? null : persisted.overallScore / 10;
  const gradedQuestions = persisted.questions as unknown as GradedQuestion[];

  const modeLabel = persisted.mode === 'standalone' ? 'Theo vị trí mục tiêu' : 'Theo job đã apply';

  // For job_fit mode, show a real job title instead of leaking the raw
  // jobId. One Postgres lookup; falls back gracefully if the job was
  // since removed from the pool.
  const job = persisted.mode === 'job_fit' && persisted.jobId
    ? await getJob(persisted.jobId).catch(() => null)
    : null;

  const targetLabel = persisted.mode === 'standalone'
    ? (persisted.roleTitle ?? '—')
    : job
      ? `${job.title}${job.company ? ` · ${job.company}` : ''}`
      : '—';

  const titleText = persisted.mode === 'standalone'
    ? (persisted.roleTitle ?? 'Kết quả luyện phỏng vấn')
    : job
      ? job.title
      : 'Kết quả luyện phỏng vấn';

  // BYOK gate for the study-plan section: operator decision is to HIDE
  // the section entirely when the user has no BYOK token, not show a
  // disabled CTA. Cookie presence-only check (token validity is
  // re-verified by the route on click). cookies() is a server-component
  // primitive — no client roundtrip.
  const byokCookie = (await cookies()).get('byok-token')?.value;
  const hasByok = !!byokCookie;

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8 px-4 md:px-6">
      <div className="border-b border-outline-variant">
        <PageHeader
          breadcrumb="Luyện phỏng vấn · Kết quả"
          title={titleText}
          subtitle={`Anchor role từ CV: ${persisted.anchorRoleTitle}`}
        />
      </div>

      <ResultsSummary
        overallScore={overallScore}
        modeLabel={modeLabel}
        targetLabel={targetLabel}
        anchorRoleTitle={persisted.anchorRoleTitle}
        completedAt={persisted.completedAt?.toISOString() ?? null}
      />

      <DualLensCard dualLens={persisted.dualLens} />

      <section aria-label="Graded questions" className="space-y-4">
        {gradedQuestions.map((q, i) => (
          <QuestionCard
            key={q.id}
            index={i}
            id={q.id}
            type={q.type}
            question={q.question}
            answer={q.user_answer ?? ''}
            {...(q.grade ? { grade: q.grade } : {})}
            readOnly
          />
        ))}
      </section>

      {/* Study plan — render persisted plan if present; else show
          generate CTA, but ONLY when the user has a BYOK cookie (per
          operator decision to hide the section entirely without BYOK). */}
      {persisted.studyPlan ? (
        <StudyPlanCard studyPlan={persisted.studyPlan} />
      ) : hasByok ? (
        <GenerateStudyPlanButton sessionId={persisted.id} />
      ) : null}
    </div>
  );
}

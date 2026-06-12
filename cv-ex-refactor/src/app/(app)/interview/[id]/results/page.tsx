// Interview results — server component, read-only render of the completed
// session. Renders DualLens + 10 graded question cards (rubric preserved
// because the API returns it for completed sessions; storage delivers the
// raw row to the server here).

import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSession } from '@/lib/get-session';
import { getSessionById } from '@/lib/interview/storage';
import { DualLensCard } from '@/features/interview/dual-lens-card';
import { QuestionCard } from '@/features/interview/question-card';
import { ResultsSummary } from '@/features/interview/results-summary';
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

  const modeLabel = persisted.mode === 'standalone' ? 'Standalone' : 'Job Fit';
  const targetLabel = persisted.mode === 'standalone'
    ? (persisted.roleTitle ?? '—')
    : (persisted.jobId ? `Job ${persisted.jobId.slice(0, 12)}` : '—');

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8 px-4 md:px-6">
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
    </div>
  );
}

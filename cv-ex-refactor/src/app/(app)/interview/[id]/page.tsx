// In-progress interview session — server component, hydrates client form.
//
// Reads session via storage (ownership-enforcing). If status='completed',
// redirects to /results so the user lands at the right surface for the
// session's state.

import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getSession } from '@/lib/get-session';
import { getSessionById } from '@/lib/interview/storage';
import { InterviewAnswerForm } from '@/features/interview/answer-form';
import { PageHeader } from '@/components/ui/page-header';
import { getJob } from '@/lib/jobs/repo-postgres';

export const metadata: Metadata = { title: 'Interview in progress — Resume Refactor' };

export const preferredRegion = 'sin1';

export default async function InterviewInProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect('/sign-in');
  const { id } = await params;

  const persisted = await getSessionById(id, session.user.id);
  if (!persisted) notFound();
  if (persisted.status === 'completed') {
    redirect(`/interview/${id}/results`);
  }

  if (persisted.status === 'abandoned') {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-12 px-4 text-center">
        <h1 className="font-display text-headline-md font-bold text-on-surface">Phiên đã hết hạn</h1>
        <p className="text-body-md text-on-surface-variant">
          Phiên luyện này được bắt đầu hơn 24h trước nhưng chưa hoàn thành. Hãy bắt đầu một phiên mới.
        </p>
        <Link
          href="/interview"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-label-md font-bold text-on-primary shadow-soft transition-opacity hover:opacity-90"
        >
          Bắt đầu phiên mới
        </Link>
      </div>
    );
  }

  // status === 'in_progress' — questions JSONB has the gen output (rubric
  // stripped per /[id] API contract, but here we read DB directly via
  // storage. Strip rubric in component props instead.).
  const questionsForUI = persisted.questions.map((q) => ({
    id: q.id,
    type: q.type,
    question: q.question,
  }));

  const job = persisted.mode === 'job_fit' && persisted.jobId
    ? await getJob(persisted.jobId).catch(() => null)
    : null;

  const titleText = persisted.mode === 'standalone'
    ? (persisted.roleTitle ?? 'Phiên luyện')
    : job
      ? `${job.title}${job.company ? ` · ${job.company}` : ''}`
      : 'Luyện phỏng vấn';
  const breadcrumb = persisted.mode === 'standalone'
    ? 'Luyện phỏng vấn · Theo vị trí mục tiêu'
    : 'Luyện phỏng vấn · Theo job đã apply';

  return (
    <div className="mx-auto max-w-4xl py-8 px-4 md:px-6">
      <div className="mb-8 border-b border-outline-variant">
        <PageHeader
          breadcrumb={breadcrumb}
          title={titleText}
          subtitle={`Anchor role từ CV: ${persisted.anchorRoleTitle}`}
        />
      </div>

      <InterviewAnswerForm
        sessionId={persisted.id}
        dualLens={persisted.dualLens}
        questions={questionsForUI}
      />
    </div>
  );
}

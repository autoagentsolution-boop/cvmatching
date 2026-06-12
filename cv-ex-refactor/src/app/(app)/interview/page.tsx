// Interview Practice landing — server component.
//
// Pre-fills `mode=job_fit` + Job header when arriving from Job Fit chevron
// (?jobId=…). Otherwise renders the standalone path with a free-text role.

import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSession } from '@/lib/get-session';
import { listUserCvs } from '@/lib/cvs/repo';
import { getJob } from '@/lib/jobs/repo-postgres';
import { InterviewStartForm } from '@/features/interview/start-form';
import { HistoryWidget } from '@/features/interview/history-widget';
import { PageHeader } from '@/components/ui/page-header';
import { isInterviewEnabled } from '@/lib/maintenance/interview-flag';

export const metadata: Metadata = { title: 'Interview Practice — Resume Refactor' };

export const preferredRegion = 'sin1';

interface SearchParams {
  jobId?: string | string[];
}

export default async function InterviewLandingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!(await isInterviewEnabled())) notFound();

  const session = await getSession();
  if (!session?.user?.id) redirect('/sign-in');
  const userId = session.user.id;

  const params = await searchParams;
  const rawJobId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId;
  const jobId = typeof rawJobId === 'string' && rawJobId.length > 0 ? rawJobId : null;

  const [cvs, job] = await Promise.all([
    listUserCvs(userId),
    jobId ? getJob(jobId).catch(() => null) : Promise.resolve(null),
  ]);

  const defaultCvId = cvs.find((c) => c.isDefault)?.id ?? cvs[0]?.id ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-8 px-4 md:px-6">
      <div className="border-b border-outline-variant">
        <PageHeader
          title="Luyện phỏng vấn"
          subtitle="AI phân tích góc nhìn recruiter và của bạn cho vị trí mục tiêu, rồi sinh 10 câu hỏi medium-hard có rubric. Trả lời xong, AI chấm theo thang 0-10."
        />
      </div>

      <InterviewStartForm
        initialJobId={job ? jobId : null}
        initialJobTitle={job?.title ?? null}
        initialCompany={job?.company ?? null}
        cvs={cvs.map((c) => ({ id: c.id, name: c.name }))}
        defaultCvId={defaultCvId}
      />

      <HistoryWidget userId={userId} limit={5} />
    </div>
  );
}

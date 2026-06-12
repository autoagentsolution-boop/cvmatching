import { JobFitDetailPage } from '@/features/job-fit/job-fit-detail-page';
import { isInterviewEnabled } from '@/lib/maintenance/interview-flag';

export default async function Page({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const interviewEnabled = await isInterviewEnabled();
  return <JobFitDetailPage jobId={jobId} interviewEnabled={interviewEnabled} />;
}

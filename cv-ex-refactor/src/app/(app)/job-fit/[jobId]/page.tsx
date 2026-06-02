import { JobFitDetailPage } from '@/features/job-fit/job-fit-detail-page';

export default async function Page({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <JobFitDetailPage jobId={jobId} />;
}

'use client';

import { DashboardLayout } from '@/components/layouts';
import { PageHeader } from '@/components/ui';
import { useJobFit } from './job-fit-store';
import { JobScoreBlock } from './job-score-block';
import { MatchReasonsBlock } from './match-reasons-block';
import { StudyTopicsBlock } from './study-topics-block';
import { DetailActionsBar } from './detail-actions-bar';
import { EmptyStateBackToList } from './empty-state-back-to-list';

interface JobFitDetailPageProps {
  jobId: string;
}

/**
 * /job-fit/[jobId] detail page orchestrator.
 *
 * Reads match from zustand store (hydrated from sessionStorage).
 * If absent (direct link, cleared session) → EmptyStateBackToList.
 */
export function JobFitDetailPage({ jobId }: JobFitDetailPageProps) {
  const { jobs } = useJobFit();
  const match = jobs.find((j) => j.jobId === jobId) ?? null;

  if (!match) {
    return (
      <DashboardLayout activeNav="job-fit" topnavTitle="Job Fit & Study">
        <EmptyStateBackToList />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout activeNav="job-fit" topnavTitle={match.title}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={match.title}
          subtitle={`${match.company}${match.location ? ` · ${match.location}` : ''}`}
          breadcrumb={
            <span>
              <a
                href="/job-fit"
                className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-tertiary-container/40 rounded"
              >
                Job Fit & Study
              </a>
              {' / '}chi tiết
            </span>
          }
        />

        <JobScoreBlock match={match} />
        <MatchReasonsBlock reasons={match.matchReasons} />
        <StudyTopicsBlock jobId={match.jobId} topics={match.studyTopics} />
        <DetailActionsBar
          jobId={match.jobId}
          {...(match.sourceUrl ? { source: extractSource(match.sourceUrl) } : {})}
        />
      </div>
    </DashboardLayout>
  );
}

/** Extract a readable source name from the job's sourceUrl. */
function extractSource(sourceUrl: string): string {
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./, '');
    return host;
  } catch {
    return 'trang tuyển dụng';
  }
}

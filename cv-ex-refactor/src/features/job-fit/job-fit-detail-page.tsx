'use client';

import { PageHeader, TierBadge } from '@/components/ui';
import { useJobFit } from './job-fit-store';
import { JobScoreBlock } from './job-score-block';
import { MatchReasonsBlock } from './match-reasons-block';
import { StudyTopicsBlock } from './study-topics-block';
import { DetailActionsBar } from './detail-actions-bar';
import { EmptyStateBackToList } from './empty-state-back-to-list';
import { MustHaveBlock } from './must-have-block';
import { CompanyCard } from './company-card';
import { CoverLetterBlock } from '@/features/refined-cv/cover-letter-block';

interface JobFitDetailPageProps {
  jobId: string;
  interviewEnabled?: boolean;
}

/**
 * /job-fit/[jobId] detail page orchestrator.
 *
 * Reads match from zustand store (hydrated from sessionStorage).
 * If absent (direct link, cleared session) → EmptyStateBackToList.
 */
export function JobFitDetailPage({ jobId, interviewEnabled = true }: JobFitDetailPageProps) {
  const { jobs } = useJobFit();
  const match = jobs.find((j) => j.jobId === jobId) ?? null;

  if (!match) {
    return <EmptyStateBackToList />;
  }

  return (
    <div className="flex flex-col gap-6">
        <PageHeader
          title={
            <span className="inline-flex items-center gap-3">
              <TierBadge tier={match.tier} reason={match.matchReasons[0]} size="md" />
              {match.title}
            </span>
          }
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

        <CompanyCard companyId={match.companyId} fallbackName={match.company} />
        <MustHaveBlock mustHaves={match.mustHaves} />
        <JobScoreBlock match={match} />
        <MatchReasonsBlock reasons={match.matchReasons} />
        <StudyTopicsBlock jobId={match.jobId} topics={match.studyTopics} />
        <CoverLetterBlock jobId={match.jobId} />
        <DetailActionsBar
          job={match}
          interviewEnabled={interviewEnabled}
          {...(match.sourceUrl ? { source: extractSource(match.sourceUrl) } : {})}
        />
    </div>
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

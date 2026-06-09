'use client';

import { MdClose } from 'react-icons/md';
import { TierBadge } from '@/components/ui';
import { JobScoreBlock } from './job-score-block';
import { MatchReasonsBlock } from './match-reasons-block';
import { StudyTopicsBlock } from './study-topics-block';
import { MustHaveBlock } from './must-have-block';
import { CompanyCard } from './company-card';
import { CoverLetterBlock } from '@/features/refined-cv/cover-letter-block';
import { DetailActionsBar } from './detail-actions-bar';
import type { JobMatchOut } from '@/lib/llm/normalize-job-recommend';

interface JobFitInlineDetailProps {
  match: JobMatchOut;
  onClose: () => void;
}

/**
 * Inline-expanded detail panel rendered immediately below a selected JobCard.
 * Mirrors the content of the standalone /job-fit/[id] page so users get the
 * full match dossier without losing context (Source CV stays at top of the
 * workflow shell, list state preserved, no navigation jank).
 *
 * Legacy /job-fit/[id] route still serves direct deep-links for shareable
 * URLs; this component is the in-list expansion that the JobCard toggles.
 */
export function JobFitInlineDetail({ match, onClose }: JobFitInlineDetailProps) {
  return (
    <section
      id={`job-detail-${match.jobId}`}
      className="mt-2 flex flex-col gap-5 rounded-2xl border border-primary/30 bg-primary/[0.02] p-6 shadow-soft"
      aria-label={`Chi tiết job ${match.title} tại ${match.company}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <TierBadge tier={match.tier} reason={match.matchReasons[0]} size="md" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="font-display text-title-lg font-bold text-on-surface">
              {match.title}
            </h3>
            <p className="text-body-sm text-on-surface-variant">
              {match.company}
              {match.location ? ` · ${match.location}` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng chi tiết"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <MdClose size={18} aria-hidden="true" />
        </button>
      </header>

      <CompanyCard companyId={match.companyId} fallbackName={match.company} />
      <MustHaveBlock mustHaves={match.mustHaves} />
      <JobScoreBlock match={match} />
      <MatchReasonsBlock reasons={match.matchReasons} />
      <StudyTopicsBlock jobId={match.jobId} topics={match.studyTopics} />
      <CoverLetterBlock jobId={match.jobId} />
      <DetailActionsBar
        job={match}
        {...(match.sourceUrl ? { source: extractSource(match.sourceUrl) } : {})}
      />
    </section>
  );
}

function extractSource(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '');
  } catch {
    return 'trang tuyển dụng';
  }
}

'use client';

import Link from 'next/link';
import { MdLocationOn, MdOpenInNew } from 'react-icons/md';
import { Badge, Card, TierBadge } from '@/components/ui';
import { TopicChip } from './topic-chip';
import { ActionButton } from './action-button';
import type { JobMatchOut } from '@/lib/llm/normalize-job-recommend';

function scoreVariant(score: number): 'success' | 'warning' | 'error' | 'neutral' {
  if (score >= 90) return 'success';
  if (score >= 75) return 'warning';
  if (score >= 60) return 'neutral';
  return 'error';
}

interface JobCardProps {
  match: JobMatchOut;
}

/**
 * Card for /job-fit list view.
 * Shows title, company, location, overallScore, top 3 matchReasons,
 * top 3 studyTopics (read-only chips), and "Xem chi tiết →" link.
 */
export function JobCard({ match }: JobCardProps) {
  const topReasons = match.matchReasons.slice(0, 3);
  const topTopics = match.studyTopics.slice(0, 3);

  return (
    <Card variant="default" padding="md" className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <TierBadge tier={match.tier} reason={match.matchReasons[0]} size="md" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="font-display text-headline-sm font-bold text-on-surface leading-tight">
              {match.title}
            </h2>
            <p className="text-body-md text-on-surface-variant">{match.company}</p>
          </div>
        </div>
        <Badge variant={scoreVariant(match.overallScore)} size="md">
          {match.overallScore}%
        </Badge>
      </div>

      {/* Location */}
      {match.location && (
        <span className="inline-flex items-center gap-1 text-label-sm text-on-surface-variant">
          <MdLocationOn size={14} aria-hidden="true" />
          {match.location}
        </span>
      )}

      {/* Match reasons */}
      {topReasons.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="Lý do phù hợp">
          {topReasons.map((reason, i) => (
            <li key={i} className="flex items-start gap-2 text-body-sm text-on-surface-variant">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary"
                aria-hidden="true"
              />
              {reason}
            </li>
          ))}
        </ul>
      )}

      {/* Study topic chips — read-only (no dislike on list card) */}
      {topTopics.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Chủ đề ôn luyện gợi ý">
          {topTopics.map((t) => (
            <TopicChip key={t.name} topic={t} />
          ))}
        </div>
      )}

      {/* Footer — per-tier primary action + chi tiết secondary */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/30 pt-3">
        <Link
          href={`/job-fit/${match.jobId}`}
          className={[
            'inline-flex items-center gap-1.5 rounded text-label-md font-bold text-primary',
            'transition-opacity hover:opacity-75',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-tertiary-container/40',
          ].join(' ')}
          aria-label={`Xem chi tiết job ${match.title} tại ${match.company}`}
        >
          Chi tiết
          <MdOpenInNew size={16} aria-hidden="true" />
        </Link>
        <ActionButton tier={match.tier} job={match} size="sm" />
      </div>
    </Card>
  );
}

'use client';

import { useState } from 'react';
import { MdAccessTime } from 'react-icons/md';
import { Badge, Card } from '@/components/ui';
import { TopicChip } from './topic-chip';
import { TIER_LABELS } from './types';
import { postDislike } from './api-client';
import { useJobFit } from './job-fit-store';
import type { StudyTopicOut } from '@/lib/llm/normalize-job-recommend';

const TIER_BADGE_VARIANT: Record<StudyTopicOut['tier'], 'success' | 'warning' | 'info'> = {
  basic: 'success',
  intermediate: 'warning',
  advanced: 'info',
};

interface StudyTopicsBlockProps {
  jobId: string;
  topics: StudyTopicOut[];
}

/**
 * Full study topics list for the detail page.
 * Each topic shows: name, tier badge, estimatedHours, whyForThisJob, dislike button.
 * Dislike is optimistic — chip dims immediately, reverts on persistent error.
 */
export function StudyTopicsBlock({ jobId, topics }: StudyTopicsBlockProps) {
  const { dislikedKeys, dislike, revertDislike } = useJobFit();
  // Track topics with in-flight dislike calls to prevent double-taps.
  const [pending, setPending] = useState<Set<string>>(new Set());

  if (topics.length === 0) return null;

  async function handleDislike(topicName: string) {
    if (pending.has(topicName)) return;

    // Optimistic update
    dislike(jobId, topicName);
    setPending((p) => new Set(p).add(topicName));

    try {
      await postDislike(jobId, topicName);
    } catch {
      // Persistent error (not 404) — revert optimistic update
      revertDislike(jobId, topicName);
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(topicName);
        return next;
      });
    }
  }

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <span className="text-label-md font-bold uppercase tracking-wide text-primary">
        Chủ đề ôn luyện
      </span>

      <ul className="flex flex-col gap-4" aria-label="Danh sách chủ đề ôn luyện">
        {topics.map((topic) => {
          const dislikedKey = `${jobId}:${topic.name}`;
          const isDisliked = dislikedKeys.includes(dislikedKey);

          return (
            <li
              key={topic.name}
              className="flex flex-col gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 transition-opacity"
              style={{ opacity: isDisliked ? 0.45 : 1 }}
            >
              {/* Header row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-label-lg font-bold text-on-surface">
                    {topic.name}
                  </span>
                  <Badge variant={TIER_BADGE_VARIANT[topic.tier]} size="sm">
                    {TIER_LABELS[topic.tier]}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  {topic.estimatedHours && (
                    <span className="inline-flex items-center gap-1 text-label-sm text-on-surface-variant">
                      <MdAccessTime size={14} aria-hidden="true" />
                      {topic.estimatedHours}
                    </span>
                  )}
                  {/* Dislike chip renders the button inline */}
                  <TopicChip
                    topic={topic}
                    disliked={isDisliked}
                    onDislike={handleDislike}
                  />
                </div>
              </div>

              {/* Why for this job */}
              {topic.whyForThisJob && (
                <p className="text-body-sm text-on-surface-variant">{topic.whyForThisJob}</p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

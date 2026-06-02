'use client';

import { MdThumbDown } from 'react-icons/md';
import { Badge } from '@/components/ui';
import { TIER_LABELS } from './types';
import type { StudyTopicOut } from '@/lib/llm/normalize-job-recommend';
import { cn } from '@/lib/cn';

const TIER_BADGE_VARIANT: Record<StudyTopicOut['tier'], 'success' | 'warning' | 'info'> = {
  basic: 'success',
  intermediate: 'warning',
  advanced: 'info',
};

interface TopicChipProps {
  topic: StudyTopicOut;
  disliked?: boolean;
  /** When provided, renders dislike button and calls this on click. */
  onDislike?: (topicName: string) => void;
  className?: string;
}

/**
 * Compact chip showing topic name + tier badge.
 * Optional dislike button for the detail page; omitted on the list card.
 */
export function TopicChip({ topic, disliked = false, onDislike, className }: TopicChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container px-3 py-1 text-label-sm text-on-surface transition-opacity',
        disliked && 'opacity-40',
        className,
      )}
    >
      <Badge variant={TIER_BADGE_VARIANT[topic.tier]} size="sm">
        {TIER_LABELS[topic.tier]}
      </Badge>
      <span>{topic.name}</span>
      {onDislike && (
        <button
          type="button"
          onClick={() => onDislike(topic.name)}
          aria-label="Không thích chủ đề này"
          disabled={disliked}
          className={cn(
            'ml-0.5 rounded-full p-0.5 text-on-surface-variant transition-colors',
            'hover:bg-error-container hover:text-on-error-container',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-tertiary-container/40',
            disliked && 'cursor-not-allowed',
          )}
        >
          <MdThumbDown size={12} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

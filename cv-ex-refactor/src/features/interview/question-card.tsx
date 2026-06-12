// Stable wrapper question card — see memory: feedback_react_stable_jsx_tree.
//
// MUST keep a single <article> wrapper. State transitions (empty / typing /
// graded) toggle CSS classes and content via `data-state`, never swap the
// wrapper element type. The textarea is a controlled component on the
// in-progress page; results page renders the same article with read-only
// content + grade pill — same wrapper, different children.

'use client';

import type { ChangeEvent } from 'react';
import { useT } from '@/lib/i18n/use-t';
import { GradePill } from './grade-pill';
import type { InterviewGrade, InterviewQuestionType } from '@/lib/llm/schemas-interview';

const MAX_CHARS = 1200;

type Mode = 'empty' | 'typing' | 'graded';

interface QuestionCardProps {
  index: number;
  id: string;
  type: InterviewQuestionType;
  question: string;
  /** undefined while live editing; set on results page. */
  answer: string;
  /** Optional grade — present only on results page. */
  grade?: InterviewGrade;
  /** Read-only on results page or while submitting. */
  readOnly?: boolean;
  onAnswerChange?: (next: string) => void;
}

export function QuestionCard({
  index,
  id,
  type,
  question,
  answer,
  grade,
  readOnly = false,
  onAnswerChange,
}: QuestionCardProps) {
  const t = useT();
  const state: Mode = grade ? 'graded' : answer.length === 0 ? 'empty' : 'typing';

  const typeLabel =
    type === 'behavioral' ? t('interview.question.behavioral')
    : type === 'technical' ? t('interview.question.technical')
    : t('interview.question.scenario');

  const charCount = t('interview.question.charCount', { count: answer.length, max: MAX_CHARS });

  return (
    <article
      data-state={state}
      className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-soft data-[state=graded]:bg-surface-container-low"
      aria-label={`Q${index + 1}`}
    >
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center rounded-full bg-tertiary-container px-3 py-1 text-label-sm font-bold text-on-tertiary-container">
          Q{index + 1} · {id}
        </span>
        <span className="inline-flex items-center rounded-full border border-outline-variant px-3 py-1 text-label-sm font-medium text-on-surface-variant">
          {typeLabel}
        </span>
        {grade && (
          <span className="ml-auto">
            <GradePill score={grade.score} />
          </span>
        )}
      </header>

      <p className="mb-3 text-body-md leading-relaxed text-on-surface">{question}</p>

      <textarea
        className="w-full resize-y rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-body-md text-on-surface leading-relaxed placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-4 focus:border-on-tertiary-container focus:ring-on-tertiary-container/10 disabled:cursor-not-allowed disabled:opacity-50"
        rows={5}
        maxLength={MAX_CHARS}
        placeholder={t('interview.question.placeholder')}
        value={answer}
        disabled={readOnly}
        readOnly={readOnly}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onAnswerChange?.(e.target.value)}
        aria-label={`Answer for Q${index + 1}`}
      />
      <p className="mt-1 text-right text-label-sm text-on-surface-variant">{charCount}</p>

      {grade && (
        <div className="mt-4 space-y-3 rounded-lg border border-outline-variant bg-surface p-4">
          <div>
            <p className="text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('interview.results.gradeFeedback')}
            </p>
            <p className="mt-1 text-body-sm text-on-surface leading-relaxed">{grade.feedback}</p>
          </div>
          <div>
            <p className="text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant">
              {t('interview.results.improvements')}
            </p>
            <ul className="mt-1 space-y-1">
              {grade.improvements.map((it, i) => (
                <li key={i} className="text-body-sm text-on-surface leading-relaxed">
                  · {it}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </article>
  );
}

export const INTERVIEW_ANSWER_MAX_CHARS = MAX_CHARS;

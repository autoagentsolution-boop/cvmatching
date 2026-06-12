// Presentational study plan render — themes grid with courses + free
// resource per theme. Data-only props so it can be embedded in either
// the server-rendered results page OR a client wrapper.

'use client';

import { MdSearch, MdMenuBook, MdSubscriptions, MdDescription } from 'react-icons/md';
import { useT } from '@/lib/i18n/use-t';
import type {
  StudyPlan,
  StudyPlanTheme,
  CourseRef,
  FreeResource,
} from '@/lib/llm/schemas-study-plan';

interface StudyPlanCardProps {
  studyPlan: StudyPlan;
}

function FreeIcon({ kind }: { kind: FreeResource['kind'] }) {
  if (kind === 'youtube') return <MdSubscriptions size={18} aria-hidden="true" />;
  if (kind === 'docs') return <MdDescription size={18} aria-hidden="true" />;
  return <MdMenuBook size={18} aria-hidden="true" />;
}

function CourseChip({ course }: { course: CourseRef }) {
  const t = useT();
  const difficultyLabelKey = `interview.studyPlan.difficulty.${course.difficulty}` as const;
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-3">
      <div className="flex flex-wrap items-center gap-2 text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-primary">
          {course.platform}
        </span>
        <span>·</span>
        <span>{t(difficultyLabelKey)}</span>
        <span>·</span>
        <span>{t('interview.studyPlan.hours', { hours: course.estimatedHours })}</span>
      </div>
      <p className="mt-1.5 text-body-md font-medium text-on-surface">{course.title}</p>
    </div>
  );
}

function ThemeCard({ theme, index }: { theme: StudyPlanTheme; index: number }) {
  const t = useT();
  const freeLabel = (
    theme.freeResource.kind === 'youtube'
      ? t('interview.studyPlan.freeKind.youtube')
      : theme.freeResource.kind === 'docs'
        ? t('interview.studyPlan.freeKind.docs')
        : t('interview.studyPlan.freeKind.book')
  );
  return (
    <article className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-soft">
      <header className="mb-3 flex items-baseline gap-2">
        <span className="inline-flex items-center rounded-full bg-tertiary-container px-2.5 py-0.5 text-label-sm font-bold text-on-tertiary-container">
          T{index + 1}
        </span>
        <h3 className="text-title-md font-bold text-on-surface">{theme.name}</h3>
      </header>

      <p className="mb-3 text-body-sm text-on-surface-variant leading-relaxed">{theme.why}</p>

      <p className="mb-4 text-label-sm text-on-surface-variant">
        {t('interview.studyPlan.linkedQuestions')}:{' '}
        {theme.linkedQuestionIds.map((id) => (
          <span
            key={id}
            className="ml-1 inline-flex items-center rounded bg-on-surface/5 px-1.5 py-0.5 font-mono"
          >
            {id}
          </span>
        ))}
      </p>

      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant">
            {t('interview.studyPlan.courses')}
          </p>
          <div className="space-y-2">
            {theme.courses.map((c, i) => (
              <CourseChip key={i} course={c} />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant">
            {t('interview.studyPlan.freeResource')}
          </p>
          <div className="flex items-start gap-2 rounded-lg border border-outline-variant bg-tertiary-container/30 p-3">
            <div className="mt-0.5 text-on-tertiary-container">
              <FreeIcon kind={theme.freeResource.kind} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-label-sm font-semibold uppercase tracking-wide text-on-tertiary-container">
                {freeLabel}
              </p>
              <p className="text-body-md font-medium text-on-surface">{theme.freeResource.title}</p>
              <p className="mt-1 text-body-sm text-on-surface-variant leading-relaxed">
                {theme.freeResource.summary}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function StudyPlanCard({ studyPlan }: StudyPlanCardProps) {
  const t = useT();
  return (
    <section aria-label={t('interview.studyPlan.title')} className="space-y-4">
      <header className="border-b border-outline-variant pb-3">
        <h2 className="text-title-lg font-bold text-on-surface">{t('interview.studyPlan.title')}</h2>
        <p className="mt-1 text-body-sm text-on-surface-variant">{t('interview.studyPlan.subtitle')}</p>
        <p className="mt-2 flex items-center gap-1.5 text-label-sm text-on-surface-variant">
          <MdSearch size={14} aria-hidden="true" />
          {t('interview.studyPlan.searchHint')}
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {studyPlan.themes.map((th, i) => (
          <ThemeCard key={i} theme={th} index={i} />
        ))}
      </div>
    </section>
  );
}

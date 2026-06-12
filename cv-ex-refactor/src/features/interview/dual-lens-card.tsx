// Presentational 4-quadrant Dual Lens card. Data-only props so it can be
// rendered from server components (results page) without crossing the RSC
// function-prop boundary.

'use client';

import { useT } from '@/lib/i18n/use-t';
import type { DualLens } from '@/lib/llm/schemas-interview';

interface DualLensCardProps {
  dualLens: DualLens;
}

interface QuadrantProps {
  title: string;
  tone: 'pos' | 'neg';
  blocks: Array<{ label: string; items: string[] }>;
}

function Quadrant({ title, tone, blocks }: QuadrantProps) {
  const accentBg = tone === 'pos' ? 'bg-tertiary-container' : 'bg-error-container/40';
  const accentText = tone === 'pos' ? 'text-on-tertiary-container' : 'text-on-error-container';
  return (
    <article
      className={`rounded-2xl border border-outline-variant/40 ${accentBg} p-5 shadow-soft`}
      aria-label={title}
    >
      <header className={`mb-3 text-label-md font-bold ${accentText}`}>{title}</header>
      <div className="space-y-3">
        {blocks.map((b) => (
          <div key={b.label}>
            <p className="text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant">
              {b.label}
            </p>
            <ul className="mt-1 space-y-1">
              {b.items.map((item, i) => (
                <li key={i} className="text-body-sm text-on-surface leading-relaxed">
                  · {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </article>
  );
}

export function DualLensCard({ dualLens }: DualLensCardProps) {
  const t = useT();
  return (
    <section aria-label={t('interview.dualLens.title')}>
      <h2 className="mb-4 text-title-lg font-bold text-on-surface">
        {t('interview.dualLens.title')}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Quadrant
          title={t('interview.dualLens.recruiterHire')}
          tone="pos"
          blocks={[
            { label: t('interview.dualLens.reasons'), items: dualLens.recruiterHire.reasons },
            { label: t('interview.dualLens.signals'), items: dualLens.recruiterHire.signals },
          ]}
        />
        <Quadrant
          title={t('interview.dualLens.recruiterNoHire')}
          tone="neg"
          blocks={[
            { label: t('interview.dualLens.risks'), items: dualLens.recruiterNoHire.risks },
            { label: t('interview.dualLens.gaps'), items: dualLens.recruiterNoHire.gaps },
          ]}
        />
        <Quadrant
          title={t('interview.dualLens.candidateHire')}
          tone="pos"
          blocks={[
            { label: t('interview.dualLens.opportunities'), items: dualLens.candidateHire.opportunities },
            { label: t('interview.dualLens.growth'), items: dualLens.candidateHire.growth },
          ]}
        />
        <Quadrant
          title={t('interview.dualLens.candidateNoHire')}
          tone="neg"
          blocks={[
            { label: t('interview.dualLens.risks'), items: dualLens.candidateNoHire.risks },
            { label: t('interview.dualLens.mismatches'), items: dualLens.candidateNoHire.mismatches },
          ]}
        />
      </div>
    </section>
  );
}

// Presentational 4-quadrant Dual Lens card.
//
// Token-pair contract: dark surfaces (bg-tertiary-container, bg-primary)
// MUST pair with text-on-tertiary-container / text-on-primary. Mixing in
// text-on-surface (the body-default near-black) on a dark card makes the
// text invisible — caught 2026-06-12 prod. All children below use the
// pair-correct token + opacity steps for hierarchy.

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
  // pos = dark surface (good news, hire). neg = light surface (concerns).
  //
  // 3-level visual hierarchy per card:
  //   title  — paired token, bold (most prominent)
  //   label  — paired token at /70 opacity (recedes)
  //   body   — explicit white on dark / explicit error red on light, so
  //            bullets POP against title + label. Operator screenshot
  //            2026-06-12 (interview2.png): pre-change all three layers
  //            were teal-on-navy and indistinguishable.
  const surface =
    tone === 'pos'
      ? 'bg-tertiary-container border-on-tertiary-container/20'
      : 'bg-error-container/40 border-error/20';
  const titleText = tone === 'pos' ? 'text-on-tertiary-container' : 'text-on-error-container';
  const labelText = tone === 'pos' ? 'text-on-tertiary-container/70' : 'text-on-surface-variant';
  const bodyText = tone === 'pos' ? 'text-white' : 'text-error';

  return (
    <article
      className={`rounded-2xl border ${surface} p-5 shadow-soft`}
      aria-label={title}
    >
      <header className={`mb-3 text-label-md font-bold ${titleText}`}>{title}</header>
      <div className="space-y-3">
        {blocks.map((b) => (
          <div key={b.label}>
            <p className={`text-label-sm font-semibold uppercase tracking-wide ${labelText}`}>
              {b.label}
            </p>
            <ul className="mt-1 space-y-1">
              {b.items.map((item, i) => (
                <li key={i} className={`text-body-sm ${bodyText} leading-relaxed`}>
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

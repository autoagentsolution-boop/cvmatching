'use client';

import { MdCheckCircleOutline } from 'react-icons/md';
import { Card } from '@/components/ui';

interface Props {
  mustHaves: readonly string[] | undefined;
  className?: string;
}

/**
 * v0.4 must-have requirements block for the Job Fit detail page.
 *
 * Returns null when no must-haves are present — keeps the page free of an
 * always-empty placeholder while ingest catches up. Once ingest populates
 * `Job.mustHaves[]`, the block auto-appears with no UI changes needed.
 *
 * No CV-comparison semantics here — must-haves are pure job-side information
 * for the candidate to self-assess. Comparison was only meaningful in the
 * v2 CV-vs-JD analyze flow, which is dropped in v0.4.
 */
export function MustHaveBlock({ mustHaves, className }: Props) {
  if (!mustHaves || mustHaves.length === 0) return null;

  return (
    <Card padding="md" {...(className ? { className } : {})}>
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-label-md font-bold uppercase tracking-wide text-primary">
          Yêu cầu bắt buộc
        </h3>
        <span className="text-label-sm font-bold text-on-surface-variant">
          {mustHaves.length}
        </span>
      </header>
      <ul className="flex flex-col gap-2" aria-label="Danh sách yêu cầu bắt buộc">
        {mustHaves.map((mh, i) => (
          <li key={`${i}-${mh.slice(0, 20)}`} className="flex items-start gap-2 text-body-md text-on-surface">
            <MdCheckCircleOutline
              size={18}
              className="mt-0.5 flex-shrink-0 text-on-tertiary-container"
              aria-hidden="true"
            />
            <span>{mh}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

'use client';

import type { Feasibility } from './types';

interface Props {
  feasibility: Feasibility;
}

/**
 * Soft banner shown when the LLM judged the aspiration as unrealistic.
 * Deliberately uses tertiary/warning tokens — not error — to keep the
 * tone encouraging rather than blocking.
 */
export function FeasibilityBanner({ feasibility }: Props) {
  if (feasibility.realistic) return null;
  const hasContent =
    feasibility.reasons.length > 0 ||
    feasibility.gentleAdvice.length > 0 ||
    !!feasibility.pragmaticAlternative;
  if (!hasContent) return null;

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-2xl border border-tertiary-fixed/60 bg-tertiary-fixed/15 p-5 text-on-surface"
    >
      <div className="flex items-start gap-3">
        <span
          className="material-symbols-outlined mt-0.5 text-on-tertiary-fixed"
          aria-hidden="true"
        >
          tips_and_updates
        </span>
        <div className="flex flex-col gap-2">
          <h4 className="text-title-sm font-bold text-on-surface">
            Mục tiêu này hơi xa so với hồ sơ hiện tại — nhưng vẫn có hướng đi
          </h4>
          {feasibility.gentleAdvice && (
            <p className="text-body-md text-on-surface-variant">
              {feasibility.gentleAdvice}
            </p>
          )}
        </div>
      </div>

      {feasibility.reasons.length > 0 && (
        <div className="flex flex-col gap-1 pl-9">
          <span className="text-label-sm font-bold uppercase tracking-wide text-on-surface-variant">
            Lý do
          </span>
          <ul className="list-disc pl-5 space-y-1">
            {feasibility.reasons.map((r) => (
              <li key={r} className="text-body-sm text-on-surface">{r}</li>
            ))}
          </ul>
        </div>
      )}

      {feasibility.pragmaticAlternative && (
        <div className="flex flex-col gap-1 pl-9">
          <span className="text-label-sm font-bold uppercase tracking-wide text-on-surface-variant">
            Đề xuất khả thi hơn
          </span>
          <p className="text-body-md text-on-surface">{feasibility.pragmaticAlternative}</p>
        </div>
      )}
    </div>
  );
}

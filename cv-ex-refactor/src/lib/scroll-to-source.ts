// Cross-component imperative helper: jump from a finding/result row back to
// the corresponding Source CV / Source JD card and flash it briefly so the
// user can re-read the context without scrolling manually.
//
// Each source card surface (jd-matching/[cvId]/layout.tsx) MUST render with
// id="source-cv-card" / id="source-jd-card" — if the IDs are missing this
// function is a no-op (defensive: never throw from a UX affordance).

export type SourceTarget = 'cv' | 'jd';

const FLASH_CLASS = 'source-flash';
const FLASH_DURATION_MS = 1800;

export function scrollToSource(target: SourceTarget): void {
  if (typeof document === 'undefined') return;
  const id = target === 'cv' ? 'source-cv-card' : 'source-jd-card';
  const el = document.getElementById(id);
  if (!el) return;

  el.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Remove + force-reflow + re-add so the animation retriggers when the user
  // clicks the same finding twice in a row.
  el.classList.remove(FLASH_CLASS);
  // Reading offsetHeight is the canonical way to force a sync layout —
  // without it the class re-add happens within the same animation frame
  // and the keyframe doesn't restart.
  void el.offsetHeight;
  el.classList.add(FLASH_CLASS);

  window.setTimeout(() => {
    el.classList.remove(FLASH_CLASS);
  }, FLASH_DURATION_MS);
}

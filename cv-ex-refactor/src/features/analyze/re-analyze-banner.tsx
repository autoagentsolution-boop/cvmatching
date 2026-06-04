'use client';

import { useEffect, useState } from 'react';
import { MdAutorenew, MdClose } from 'react-icons/md';
import { Button } from '@/components/ui';
import { useAnalysis } from './analysis-store';
import {
  detectLegacyCache,
  clearLegacyCache,
  markBannerDismissed,
  isBannerDismissed,
  type LegacyCachePresence,
} from './cache-migration';

/**
 * v0.4 re-analyze banner — surfaces only when sessionStorage carries
 * v1-shaped analyze cache from a pre-pivot session. Click "Phân tích lại"
 * pre-fills CV into the new store and clears legacy; dismiss persists a
 * localStorage flag so the banner doesn't re-appear across tabs/sessions.
 *
 * Per decision #4 + [[feedback_scoring_ux_model]]: never auto-fire the
 * analyze API on legacy detect — that would silently burn the user's
 * 5/day quota on a session they may not even be aware of.
 */
export function ReAnalyzeBanner() {
  const [legacy, setLegacy] = useState<LegacyCachePresence | null>(null);
  const setField = useAnalysis((s) => s.setField);

  useEffect(() => {
    if (isBannerDismissed()) return;
    const result = detectLegacyCache();
    if (result.found) setLegacy(result);
  }, []);

  if (!legacy?.found) return null;

  function handleReAnalyze() {
    if (legacy?.cvText) setField('cvText', legacy.cvText);
    clearLegacyCache();
    setLegacy(null);
    // Scroll the analyze button into view so user only needs one more click.
    requestAnimationFrame(() => {
      document
        .querySelector('button[aria-label], main')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function handleDismiss() {
    markBannerDismissed();
    setLegacy(null);
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-on-tertiary-container/30 bg-tertiary-container/50 px-4 py-3"
    >
      <MdAutorenew size={20} className="flex-shrink-0 text-on-tertiary-container" aria-hidden="true" />
      <p className="flex-1 min-w-[200px] text-body-md text-on-surface">
        Ứng dụng đã cập nhật — Analyze theo cấu trúc CV-solo mới. Bấm{' '}
        <strong>Phân tích lại</strong> để chấm lại theo prompt mới
        {legacy.cvText ? ' (CV cũ đã được nạp sẵn)' : ''}.
      </p>
      <Button variant="primary" size="sm" onClick={handleReAnalyze}>
        Phân tích lại
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDismiss}
        aria-label="Đóng thông báo cập nhật"
      >
        <MdClose size={16} aria-hidden="true" />
      </Button>
    </div>
  );
}

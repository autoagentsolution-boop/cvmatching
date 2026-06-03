'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { Button, Card, EmptyState, ErrorState, LoadingState, MarkdownView } from '@/components/ui';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { RedFlagsBanner } from './red-flags-banner';
import { RefinedCvModeBanner } from './refined-cv-mode-banner';

export function RefinedCvView() {
  const { matchedCv, refineNotes, isGeneratingCv, error, result } = useAnalysis();

  // Mode banner reads URL params + job-fit store; render whenever query is present
  // so the user can kick off Wave A refine flow even before matchedCv exists.
  const modeBanner = (
    <Suspense fallback={null}>
      <RefinedCvModeBanner />
    </Suspense>
  );

  if (isGeneratingCv) {
    return (
      <div className="flex flex-col gap-4">
        {modeBanner}
        <LoadingState variant="skeleton" lines={12} message="Generating refined CV..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        {modeBanner}
        <ErrorState title="Generation failed" description={error} />
      </div>
    );
  }

  if (!matchedCv) {
    return (
      <div className="flex flex-col gap-4">
        {modeBanner}
        <EmptyState
          title="Chưa có Refined CV"
          description="Refined CV là CV được rewrite cho một JD cụ thể. Hãy chạy Analyze (paste CV + JD) trước, rồi bấm Generate refined CV trên trang kết quả."
          action={
            <Button asChild variant="primary">
              <Link href="/">Bắt đầu ở Analyze</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {modeBanner}
      {result?.redFlags && <RedFlagsBanner redFlags={result.redFlags} />}
      <Card padding="lg">
        <MarkdownView markdown={matchedCv} variant="document" />
      </Card>
      {refineNotes && (
        <Card padding="lg" className="border-l-4 border-l-primary bg-surface-container-low">
          <header className="mb-2 flex items-center gap-2">
            <span className="text-label-sm font-bold uppercase tracking-wide text-primary">
              Refine notes
            </span>
            <span className="text-label-sm text-on-surface-variant">
              · Chỉ cho bạn — KHÔNG nằm trong CV gửi recruiter
            </span>
          </header>
          <MarkdownView markdown={refineNotes} variant="document" />
        </Card>
      )}
    </div>
  );
}

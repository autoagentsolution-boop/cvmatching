'use client';

import Link from 'next/link';
import { Button, Card, EmptyState, ErrorState, LoadingState, MarkdownView } from '@/components/ui';
import { useAnalysis } from '@/features/analyze/analysis-store';

export function RefinedCvView() {
  const { matchedCv, isGeneratingCv, error } = useAnalysis();

  if (isGeneratingCv) {
    return <LoadingState variant="skeleton" lines={12} message="Generating refined CV..." />;
  }

  if (error) {
    return <ErrorState title="Generation failed" description={error} />;
  }

  if (!matchedCv) {
    return (
      <EmptyState
        title="Chưa có Refined CV"
        description="Refined CV là CV được rewrite cho một JD cụ thể. Hãy chạy Analyze (paste CV + JD) trước, rồi bấm Generate refined CV trên trang kết quả."
        action={
          <Button asChild variant="primary">
            <Link href="/">Bắt đầu ở Analyze</Link>
          </Button>
        }
      />
    );
  }

  return (
    <Card padding="lg">
      <MarkdownView markdown={matchedCv} variant="document" />
    </Card>
  );
}

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
        title="No refined CV yet"
        description="Run an analysis and click Generate refined CV to see your tailored markdown here."
        action={
          <Button asChild variant="primary">
            <Link href="/">Go to Analyze</Link>
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

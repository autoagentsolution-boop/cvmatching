import { FormPageLayout } from '@/components/layouts';
import { PageHeader } from '@/components/ui';
import { ResultsSection } from '@/features/results/results-section';
import { AnalyzeActions } from './analyze-actions';
import { AnalysisParametersBlock } from './analysis-parameters-block';
import { CvInputBlock } from './cv-input-block';
import { JdInputBlock } from './jd-input-block';

/**
 * Server component — composes the full Analyze page per Stitch dashboard reference.
 * Layout: header → 2-col bento (CV + JD) → section 3 full-width → CTA → ResultsSection.
 * Section headers live inside each block to match Stitch's varying header treatment.
 */
export function AnalyzePage() {
  return (
    <FormPageLayout
      header={
        <PageHeader
          title={
            <>
              Match your profile to your{' '}
              <span className="text-on-tertiary-container">dream role.</span>
            </>
          }
          subtitle="Upload your CV and the Job Description. Our AI will analyze the alignment, find keyword gaps, and score your readiness."
        />
      }
      actionsSlot={<AnalyzeActions />}
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <CvInputBlock />
        <JdInputBlock />
      </div>

      <AnalysisParametersBlock />

      <ResultsSection />
    </FormPageLayout>
  );
}

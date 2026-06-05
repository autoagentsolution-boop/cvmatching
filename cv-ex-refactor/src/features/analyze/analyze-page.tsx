import { FormPageLayout } from '@/components/layouts';
import { PageHeader } from '@/components/ui';
import { ResultsSection } from '@/features/results/results-section';
import { AnalyzeActions } from './analyze-actions';
import { AnalysisParametersBlock } from './analysis-parameters-block';
import { CvInputBlock } from './cv-input-block';
import { ReAnalyzeBanner } from './re-analyze-banner';

/**
 * v0.4 CV-Solo Analyze page.
 *
 * JD-input + must-have surfaces removed (see plan
 * plans/260604-1356-v04-cv-solo-analyze-pivot/phase-03-ui-analyze-restructure.md).
 * Must-have UI relocates to Job Fit detail (Phase 4). Role inference runs
 * server-side; the role-confirm modal is mounted via AnalyzeActions when
 * the API returns needsRoleConfirm.
 */
export function AnalyzePage() {
  return (
    <FormPageLayout
      className="max-w-[1180px]"
      header={
        <PageHeader
          title={
            <>
              Đánh giá CV của bạn{' '}
              <span className="text-on-tertiary-container">cho vai trò mục tiêu</span>
            </>
          }
          subtitle="Dán CV của bạn — AI suy luận vai trò bạn đang nhắm tới và chấm điểm theo 9 chiều chất lượng của recruiter (không cần JD)."
        />
      }
      actionsSlot={<AnalyzeActions />}
    >
      <ReAnalyzeBanner />
      <CvInputBlock source="analyze" />

      <AnalysisParametersBlock />

      <ResultsSection source="analyze" />
    </FormPageLayout>
  );
}

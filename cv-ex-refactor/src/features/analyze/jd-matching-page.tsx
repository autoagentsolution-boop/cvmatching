import { FormPageLayout } from '@/components/layouts';
import { PageHeader } from '@/components/ui';
import { ResultsSection } from '@/features/results/results-section';
import { AnalysisParametersBlock } from './analysis-parameters-block';
import { CvInputBlock } from './cv-input-block';
import { JdInputBlock } from './jd-input-block';
import { JdMatchingActions } from './jd-matching-actions';
import { MustHavesBlock } from './must-haves-block';

/**
 * JD Matching — restored v2 CV-vs-JD flow as a standalone page for users
 * who already have a target JD and want to score their CV against it.
 * Coexists with /analyze (v0.4 CV-solo). Reuses the same analyze backend
 * via dispatch.isV3Shape (presence of jdText → v2 handler).
 */
export function JdMatchingPage() {
  return (
    <FormPageLayout
      className="max-w-[1180px]"
      header={
        <PageHeader
          title={
            <>
              So khớp CV{' '}
              <span className="text-on-tertiary-container">với mô tả công việc</span>
            </>
          }
          subtitle="Dán CV của bạn cùng JD bạn đang nhắm tới — AI chấm điểm phù hợp, làm rõ điểm mạnh, gap, và must-have requirements."
        />
      }
      actionsSlot={<JdMatchingActions />}
    >
      <CvInputBlock />
      <JdInputBlock />
      <MustHavesBlock />
      <AnalysisParametersBlock source="jd-matching" />
      <ResultsSection source="jd-matching" />
    </FormPageLayout>
  );
}

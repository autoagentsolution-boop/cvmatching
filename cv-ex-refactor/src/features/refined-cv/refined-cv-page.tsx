import { DetailPanelLayout } from '@/components/layouts';
import { PageHeader } from '@/components/ui';
import { DownloadActions } from './download-actions';
import { KeyEnhancementsBlock } from './key-enhancements-block';
import { RefineToolsBlock } from './refine-tools-block';
import { RefinedCvView } from './refined-cv-view';
import { MatchScoreBlockAside } from './match-score-block-aside';
import { JobFitCtaSection } from './job-fit-cta-section';

/**
 * RSC — composes DetailPanelLayout for the /refined-cv route.
 * Auth check omitted: BYOK guests must access their generated CV without auth.
 *
 * v0.4: JobFitCtaSection unlocked for all users. The Analyze → Refined CV
 * → Job Fit chain is the canonical CV-solo flow; the admin gate from v0.3
 * (KV-seed pilot caution) no longer applies now that the job pool is live.
 */
export function RefinedCvPage() {
  return (
    <DetailPanelLayout
      header={
        <PageHeader
          title="Refined CV"
          subtitle="CV được tinh chỉnh cho vai trò bạn nhắm tới."
          action={<DownloadActions />}
        />
      }
      asideSlot={
        <div className="flex flex-col gap-4">
          <MatchScoreBlockAside />
          <KeyEnhancementsBlock />
          <RefineToolsBlock />
        </div>
      }
      asideWidth="md"
    >
      <RefinedCvView />
      <JobFitCtaSection />
    </DetailPanelLayout>
  );
}

import { DetailPanelLayout } from '@/components/layouts';
import { PageHeader } from '@/components/ui';
import { DownloadActions } from './download-actions';
import { RefineToolsBlock } from './refine-tools-block';
import { RefinedCvView } from './refined-cv-view';
import { RefinedCvAsideGate } from './refined-cv-aside-gate';
import { JobFitCtaSection } from './job-fit-cta-section';

export type WorkflowMode = 'cv-solo' | 'jd-context';

export interface RefinedCvPageProps {
  mode?: WorkflowMode;
}

/**
 * RSC — composes DetailPanelLayout for /refined-cv and the workflow
 * step routes.
 *
 * Aside content (Phase 6 user-feedback cleanup):
 *  - Overall Score + Key Enhancements removed — already on the CV Analyze
 *    page, the chevron stepper means the user just left them on the
 *    previous step.
 *  - Refine Tools rendered only when an analyze result is in the store;
 *    otherwise the aside shows a redirect CTA back to CV Analyze.
 *  - That gating runs inside the client component so the aside can read
 *    analysis-store; the page itself stays a server component.
 */
export function RefinedCvPage({ mode }: RefinedCvPageProps = {}) {
  void mode;
  return (
    <DetailPanelLayout
      header={
        <PageHeader
          title="Refined CV"
          subtitle="CV được tinh chỉnh cho vai trò bạn nhắm tới."
          action={<DownloadActions />}
        />
      }
      asideSlot={<RefinedCvAsideGate refineTools={<RefineToolsBlock />} />}
      asideWidth="md"
    >
      <RefinedCvView />
      <JobFitCtaSection />
    </DetailPanelLayout>
  );
}

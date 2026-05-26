import { DetailPanelLayout } from '@/components/layouts';
import { PageHeader } from '@/components/ui';
import { DownloadActions } from './download-actions';
import { KeyEnhancementsBlock } from './key-enhancements-block';
import { RefineToolsBlock } from './refine-tools-block';
import { RefinedCvView } from './refined-cv-view';
import { MatchScoreBlockAside } from './match-score-block-aside';

/**
 * RSC — composes DetailPanelLayout for the /refined-cv route.
 * Auth check omitted: BYOK guests must access their generated CV without auth.
 * Locked decisions #4 (no PDF), #5 (no cover letter), #9 (plain markdown).
 */
export function RefinedCvPage() {
  return (
    <DetailPanelLayout
      header={
        <PageHeader
          title="Refined CV"
          subtitle="Your CV optimised for the target role."
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
    </DetailPanelLayout>
  );
}

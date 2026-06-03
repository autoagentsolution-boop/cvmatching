import { Suspense } from 'react';
import { DetailPanelLayout } from '@/components/layouts';
import { PageHeader } from '@/components/ui';
import { getSession } from '@/lib/get-session';
import { isAdminUser } from '@/lib/usage/admin-auth';
import { DownloadActions } from './download-actions';
import { KeyEnhancementsBlock } from './key-enhancements-block';
import { RefineToolsBlock } from './refine-tools-block';
import { RefinedCvView } from './refined-cv-view';
import { MatchScoreBlockAside } from './match-score-block-aside';
import { CoverLetterBlock } from './cover-letter-block';
import { JobFitCtaSection } from './job-fit-cta-section';

/**
 * RSC — composes DetailPanelLayout for the /refined-cv route.
 * Auth check omitted: BYOK guests must access their generated CV without auth.
 * Locked decisions #4 (no PDF), #9 (plain markdown).
 * Cover Letter: Phase 2 placeholder stub rendered in aside.
 * Job Fit CTA is admin-only during the v0.3 KV-seed pilot.
 */
export async function RefinedCvPage() {
  const session = await getSession().catch(() => null);
  const isAdmin = isAdminUser(session?.user);

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
          <Suspense fallback={null}>
            <CoverLetterBlock />
          </Suspense>
        </div>
      }
      asideWidth="md"
    >
      <RefinedCvView />
      {isAdmin && <JobFitCtaSection />}
    </DetailPanelLayout>
  );
}

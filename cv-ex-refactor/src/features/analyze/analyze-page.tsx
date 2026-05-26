import { FormPageLayout } from '@/components/layouts';
import { PageHeader } from '@/components/ui';
import { getSession } from '@/lib/get-session';
import { AnalyzeActions } from './analyze-actions';
import { AnalysisParametersBlock } from './analysis-parameters-block';
import { CvInputBlock } from './cv-input-block';
import { JdInputBlock } from './jd-input-block';
import { SettingsPanelBlock } from './settings-panel-block';

interface AnalyzePageProps {
  searchParams: { mode?: string };
}

/**
 * Server component — reads session + searchParams, passes isAuthed/defaultExpanded
 * as props to client sub-components. Never calls 'use client' hooks here.
 */
export async function AnalyzePage({ searchParams }: AnalyzePageProps) {
  let isAuthed = false;
  try {
    const session = await getSession();
    isAuthed = session !== null;
  } catch {
    // getSession may throw in dev without AUTH_SECRET — safe default to false
  }

  const defaultByok = searchParams.mode === 'byok';

  return (
    <FormPageLayout
      header={
        <PageHeader
          title="Match your profile to your dream role"
          subtitle="Upload your CV and job description. Our AI will score your fit, surface keyword gaps, and rank your readiness."
        />
      }
      actionsSlot={<AnalyzeActions />}
      meta="Estimated processing time: 4–6 seconds"
    >
      <SettingsPanelBlock isAuthed={isAuthed} defaultExpanded={defaultByok} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <JdInputBlock />
        <CvInputBlock />
      </div>

      <AnalysisParametersBlock />
    </FormPageLayout>
  );
}

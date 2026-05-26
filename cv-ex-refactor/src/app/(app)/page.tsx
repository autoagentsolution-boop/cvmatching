import { FormPageLayout } from '@/components/layouts';
import { EmptyState, PageHeader } from '@/components/ui';

export default function AnalyzePage() {
  return (
    <FormPageLayout
      header={
        <PageHeader
          title="Match your profile to your dream role"
          subtitle="Paste your CV and a job description to get an AI-powered match score."
        />
      }
    >
      <EmptyState
        title="Analyze form loading"
        description="The input form will be available in the next implementation slice."
      />
    </FormPageLayout>
  );
}

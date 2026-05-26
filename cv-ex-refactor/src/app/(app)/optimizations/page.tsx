import { MdInsights } from 'react-icons/md';
import { EmptyState, PageHeader } from '@/components/ui';

export default function OptimizationsPage() {
  return (
    <>
      <PageHeader title="Optimizations" subtitle="Skill and ATS improvement insights" />
      <EmptyState
        icon={<MdInsights className="text-4xl" aria-hidden="true" />}
        title="Coming in Phase 2"
        description="Keyword gap analysis and ATS improvement suggestions will be available in a future release."
      />
    </>
  );
}

import { MdHistory } from 'react-icons/md';
import { EmptyState, PageHeader } from '@/components/ui';

export default function HistoryPage() {
  return (
    <>
      <PageHeader title="History" subtitle="Your past analyses" />
      <EmptyState
        icon={<MdHistory className="text-4xl" aria-hidden="true" />}
        title="Coming in Phase 2"
        description="Saved analysis history will be available in a future release."
      />
    </>
  );
}

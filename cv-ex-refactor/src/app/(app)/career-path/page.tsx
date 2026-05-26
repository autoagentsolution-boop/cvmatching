import { MdRoute } from 'react-icons/md';
import { EmptyState, PageHeader } from '@/components/ui';

export default function CareerPathPage() {
  return (
    <>
      <PageHeader title="Career Path" subtitle="Recommended next steps" />
      <EmptyState
        icon={<MdRoute className="text-4xl" aria-hidden="true" />}
        title="Coming in Phase 2"
        description="Personalised career progression recommendations will be available in a future release."
      />
    </>
  );
}

import { Suspense } from 'react';
import { CareerPathPage } from '@/features/career-path/career-path-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CareerPathPage />
    </Suspense>
  );
}

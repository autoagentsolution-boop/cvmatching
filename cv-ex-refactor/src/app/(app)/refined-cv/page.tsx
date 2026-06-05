import { RefinedCvPage } from '@/features/refined-cv/refined-cv-page';

// Opt out of static prerender. The page is 100% client-state-driven
// (analysis-store + ?from=/?jobId= URL params via useSearchParams in
// useSourceData). Prerender has no value AND triggers Next.js's
// "missing-suspense-with-csr-bailout" error since the resolver hook is
// now reached by many child components. Force-dynamic skips the prerender
// step entirely — page still SSRs at request time, just not at build.
export const dynamic = 'force-dynamic';

export default async function Page() {
  return <RefinedCvPage />;
}

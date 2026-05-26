import { AnalyzePage } from '@/features/analyze/analyze-page';

/**
 * Next.js 15: searchParams is a Promise — must await before passing to page components.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const sp = await searchParams;
  return <AnalyzePage searchParams={sp} />;
}

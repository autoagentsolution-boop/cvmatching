'use client';

import { usePathname } from 'next/navigation';
import { SourceDocumentCard } from '@/components/ui/source-document-card';
import { cn } from '@/lib/cn';
import { JdSourceCard } from './jd-source-card';

interface JdMatchingSourceAreaProps {
  cvContent: string;
  cvId: string;
  cvOriginalMime: string | null;
}

/**
 * Step-aware source rendering for the JD Matching workflow.
 *
 *   /match  → CV + JD side-by-side (works with sourceLayout='top' upstream).
 *   /refined, /roadmap, /jobfit → CV only (sourceLayout='left' upstream).
 *
 * The component renders the SAME JSX tree on every step — only class names
 * change. That stability is load-bearing: branching the tree (returning a
 * different element / wrapper depending on `isMatchStep`) would force
 * React to unmount the CV card and the PDF iframe inside, triggering a
 * fresh fetch of the (potentially several-MB) PDF on every chevron click.
 * Felt as visible lag.
 */
export function JdMatchingSourceArea({
  cvContent,
  cvId,
  cvOriginalMime,
}: JdMatchingSourceAreaProps) {
  const pathname = usePathname();
  const isMatchStep = /\/jd-matching\/[^/]+\/match(\/|$)/.test(pathname);

  return (
    <div
      className={cn(
        'grid gap-3',
        isMatchStep ? 'lg:grid-cols-2' : 'lg:grid-cols-1',
      )}
    >
      <div id="source-cv-card" className="scroll-mt-20">
        <SourceDocumentCard
          content={cvContent}
          kind="cv"
          defaultZoom={0.75}
          originalUrl={`/api/cvs/${cvId}/original`}
          {...(cvOriginalMime ? { originalMime: cvOriginalMime } : {})}
        />
      </div>
      <div
        id="source-jd-card"
        className={cn('scroll-mt-20', !isMatchStep && 'hidden')}
        aria-hidden={!isMatchStep}
      >
        <JdSourceCard />
      </div>
    </div>
  );
}

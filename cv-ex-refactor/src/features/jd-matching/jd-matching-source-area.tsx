'use client';

import { usePathname } from 'next/navigation';
import { SourceDocumentCard } from '@/components/ui/source-document-card';
import { JdSourceCard } from './jd-source-card';

interface JdMatchingSourceAreaProps {
  cvContent: string;
  cvId: string;
  cvOriginalMime: string | null;
}

/**
 * Step-aware source rendering for the JD Matching workflow:
 *  - /match → CV + JD side-by-side (works in concert with sourceLayout='top'
 *    in the parent WorkflowLayout — full-width row across the top).
 *  - /refined, /roadmap, /jobfit → CV-only (sourceLayout='left' renders this
 *    in the vertical aside, matching the CV Analyze workflow pattern).
 *
 * Detection uses the URL because Next.js layouts at the /[cvId] segment
 * don't receive the [step] param, but client components can read pathname.
 */
export function JdMatchingSourceArea({
  cvContent,
  cvId,
  cvOriginalMime,
}: JdMatchingSourceAreaProps) {
  const pathname = usePathname();
  const isMatchStep = /\/jd-matching\/[^/]+\/match(\/|$)/.test(pathname);

  const cvCard = (
    <div id="source-cv-card" className="scroll-mt-20">
      <SourceDocumentCard
        content={cvContent}
        kind="cv"
        defaultZoom={isMatchStep ? 0.75 : 1}
        originalUrl={`/api/cvs/${cvId}/original`}
        {...(isMatchStep ? {} : { className: 'h-full min-h-[400px]' })}
        {...(cvOriginalMime ? { originalMime: cvOriginalMime } : {})}
      />
    </div>
  );

  if (!isMatchStep) return cvCard;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {cvCard}
      <div id="source-jd-card" className="scroll-mt-20">
        <JdSourceCard />
      </div>
    </div>
  );
}

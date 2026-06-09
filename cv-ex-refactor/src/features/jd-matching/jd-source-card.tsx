'use client';

import { SourceDocumentCard } from '@/components/ui/source-document-card';
import { useAnalysis } from '@/features/analyze/analysis-store';

/**
 * Client wrapper around SourceDocumentCard that reads the live JD content
 * from the analysis store. Lives in jd-matching/[cvId]/layout.tsx beneath
 * the Source CV card, so the JD preview persists across chevron step
 * navigation just like the CV iframe does.
 *
 * Behavior:
 *  - jdText empty → empty state with import hint
 *  - jdOriginalBlobUrl + jdMime='application/pdf' → PDF iframe (file upload)
 *  - otherwise → styled text render of jdText (paste / URL scrape / non-PDF file)
 */
export function JdSourceCard() {
  const jdText = useAnalysis((s) => s.jdText);
  const jdMime = useAnalysis((s) => s.jdMime);
  const jdOriginalBlobUrl = useAnalysis((s) => s.jdOriginalBlobUrl);

  const hasPdfPreview = !!jdOriginalBlobUrl && jdMime === 'application/pdf';

  return (
    <SourceDocumentCard
      content={jdText}
      kind="jd"
      defaultZoom={0.75}
      {...(hasPdfPreview && jdOriginalBlobUrl ? { originalUrl: jdOriginalBlobUrl } : {})}
      {...(jdMime ? { originalMime: jdMime } : {})}
      emptyHint={
        <p className="text-[11px] text-on-surface-variant/70">
          Paste, link a posting URL, or upload a PDF/Word job description on the right.
        </p>
      }
    />
  );
}

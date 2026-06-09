'use client';

import { useMemo, useState } from 'react';
import { MdOpenInNew, MdFullscreen } from 'react-icons/md';
import { SourceDocumentCard } from '@/components/ui/source-document-card';
import { Modal } from '@/components/ui/modal';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { cn } from '@/lib/cn';

/**
 * JdSourceCard — Source JD viewer for the JD Matching workflow.
 *
 * Render priority:
 *  1. PDF iframe — when a PDF was uploaded (jdOriginalBlobUrl + jdMime).
 *  2. Reader view — when JD came from URL scrape (jdSourceHtml present).
 *     A mini-browser style chrome (fake URL bar + open-in-new) wraps the
 *     cleaned article HTML.
 *  3. Styled text view — paste mode or DOCX/TXT file upload.
 *  4. Empty state — nothing imported yet.
 *
 * SECURITY NOTE: jdSourceHtml comes from Readability / JSON-LD on the
 * server side, both of which strip script tags and dangerous attributes.
 * The sanitizer below is defense-in-depth — it kills <script>, <iframe>,
 * <object>, and any `on*` event-handler attributes before insertion.
 */

function sanitizeHtml(html: string): string {
  return html
    // Drop <script>...</script> blocks entirely
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    // Drop standalone <iframe>, <object>, <embed> tags
    .replace(/<(iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(iframe|object|embed)\b[^>]*\/?\s*>/gi, '')
    // Strip on* event handlers (onclick, onerror, ...)
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    // Strip javascript: URLs in href / src
    .replace(/(href|src)\s*=\s*"\s*javascript:[^"]*"/gi, '$1=""')
    .replace(/(href|src)\s*=\s*'\s*javascript:[^']*'/gi, "$1=''");
}

export function JdSourceCard() {
  const jdText = useAnalysis((s) => s.jdText);
  const jdMime = useAnalysis((s) => s.jdMime);
  const jdOriginalBlobUrl = useAnalysis((s) => s.jdOriginalBlobUrl);
  const jdSourceHtml = useAnalysis((s) => s.jdSourceHtml);
  const jdSourceTitle = useAnalysis((s) => s.jdSourceTitle);
  const jdUrl = useAnalysis((s) => s.jdUrl);

  const hasPdfPreview = !!jdOriginalBlobUrl && jdMime === 'application/pdf';
  const hasReaderView = !!jdSourceHtml && !hasPdfPreview;

  // PDF path → delegate to shared SourceDocumentCard.
  if (hasPdfPreview) {
    return (
      <SourceDocumentCard
        content={jdText}
        kind="jd"
        defaultZoom={0.75}
        {...(jdOriginalBlobUrl ? { originalUrl: jdOriginalBlobUrl } : {})}
        {...(jdMime ? { originalMime: jdMime } : {})}
      />
    );
  }

  // Reader view path → custom mini-browser chrome.
  if (hasReaderView) {
    return (
      <ReaderViewCard
        html={jdSourceHtml}
        title={jdSourceTitle || jdUrl}
        sourceUrl={jdUrl}
      />
    );
  }

  // Paste / DOCX / TXT / empty → fall back to shared card's styled view.
  return (
    <SourceDocumentCard
      content={jdText}
      kind="jd"
      defaultZoom={0.75}
      emptyHint={
        <p className="text-[11px] text-on-surface-variant/70">
          Paste, link a posting URL, or upload a PDF/Word job description on the right.
        </p>
      }
    />
  );
}

function ReaderViewCard({
  html,
  title,
  sourceUrl,
}: {
  html: string;
  title: string;
  sourceUrl: string;
}) {
  const cleanHtml = useMemo(() => sanitizeHtml(html), [html]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <>
      <div
        className={cn(
          'flex flex-col overflow-hidden rounded-xl border border-outline-variant',
          'bg-surface-container-lowest',
        )}
      >
        {/* Section label */}
        <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
            Source JD
          </span>
          <div className="flex items-center gap-0.5">
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open original posting"
                aria-label="Open original posting in new tab"
                className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
              >
                <MdOpenInNew size={16} aria-hidden="true" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              title="Fullscreen"
              aria-label="Open fullscreen"
              className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              <MdFullscreen size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Mini-browser URL bar */}
        {sourceUrl && (
          <div className="flex items-center gap-2 border-b border-outline-variant bg-surface-container-low/60 px-3 py-1.5">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-error/70" aria-hidden="true" />
              <span className="h-2.5 w-2.5 rounded-full bg-tertiary/70" aria-hidden="true" />
              <span className="h-2.5 w-2.5 rounded-full bg-primary/70" aria-hidden="true" />
            </div>
            <div className="flex flex-1 items-center gap-1.5 truncate rounded-md border border-outline-variant bg-surface px-2.5 py-1 text-label-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px] text-on-surface-variant/60" aria-hidden="true">
                lock
              </span>
              <span className="truncate">{sourceUrl}</span>
            </div>
          </div>
        )}

        {/* Reader article body */}
        <div className="overflow-auto bg-surface px-5 py-4 max-h-[60vh]">
          <ReaderArticle title={title} html={cleanHtml} />
        </div>
      </div>

      {/* Fullscreen modal — same chrome, bigger viewport */}
      <Modal
        open={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        size="lg"
        className="max-w-[min(calc(100vw-3rem),10in)] max-h-[calc(100vh-3rem)] overflow-auto p-6"
      >
        <div className="mb-3 flex items-center justify-between gap-2 pr-8">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
            Source JD
          </span>
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-label-sm font-semibold text-primary hover:underline"
            >
              Open original <MdOpenInNew size={14} aria-hidden="true" />
            </a>
          )}
        </div>
        <div className="rounded-lg border border-outline-variant bg-surface px-6 py-5">
          <ReaderArticle title={title} html={cleanHtml} />
        </div>
      </Modal>
    </>
  );
}

function ReaderArticle({ title, html }: { title: string; html: string }) {
  return (
    <article
      className={cn(
        'prose prose-sm max-w-none',
        // Style overrides so the cleaned HTML harmonizes with the design
        // system. Plain CSS classes — keeps the bundle out of @tailwindcss/typography.
        '[&_h1]:mt-0 [&_h1]:mb-3 [&_h1]:text-title-lg [&_h1]:font-bold [&_h1]:text-on-surface',
        '[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-title-md [&_h2]:font-semibold [&_h2]:text-on-surface',
        '[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-title-sm [&_h3]:font-semibold [&_h3]:text-on-surface',
        '[&_p]:my-2 [&_p]:text-body-sm [&_p]:leading-relaxed [&_p]:text-on-surface',
        '[&_ul]:my-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:text-body-sm [&_ul]:text-on-surface',
        '[&_ol]:my-2 [&_ol]:pl-5 [&_ol]:list-decimal [&_ol]:text-body-sm [&_ol]:text-on-surface',
        '[&_li]:my-1 [&_li]:leading-relaxed',
        '[&_strong]:font-semibold [&_strong]:text-on-surface',
        '[&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline',
        '[&_img]:rounded-md [&_img]:max-w-full [&_img]:h-auto',
      )}
    >
      {title && (
        <h1>{title}</h1>
      )}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}

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

// Minimal reader-mode stylesheet injected into the iframe. Uses native browser
// defaults for tag spacing (so wall-of-divs from cheerio fallback still has UA
// line breaks), then adds prose-like typography on top. No app CSS leaks in.
const READER_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #111; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    padding: 20px 22px 32px;
    word-wrap: break-word;
  }
  h1 { font-size: 22px; line-height: 1.25; margin: 0 0 14px; font-weight: 700; }
  h2 { font-size: 18px; line-height: 1.3; margin: 22px 0 10px; font-weight: 600; }
  h3 { font-size: 16px; line-height: 1.35; margin: 18px 0 8px; font-weight: 600; }
  h4, h5, h6 { font-size: 14px; margin: 14px 0 6px; font-weight: 600; }
  p { margin: 10px 0; }
  ul, ol { margin: 10px 0; padding-left: 22px; }
  li { margin: 4px 0; }
  strong, b { font-weight: 600; }
  em, i { font-style: italic; }
  a { color: #2563eb; text-decoration: underline; text-underline-offset: 2px; }
  a:hover { text-decoration: none; }
  hr { border: 0; border-top: 1px solid #e5e7eb; margin: 18px 0; }
  blockquote {
    margin: 12px 0; padding: 6px 14px;
    border-left: 3px solid #d1d5db; color: #4b5563;
    background: #f9fafb;
  }
  img { max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px 0; }
  table { border-collapse: collapse; margin: 12px 0; max-width: 100%; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; font-size: 13px; }
  th { background: #f3f4f6; font-weight: 600; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; background: #f3f4f6; padding: 1px 5px; border-radius: 3px; }
  pre { background: #f3f4f6; padding: 10px 12px; border-radius: 6px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  /* Cheerio's main-content fallback often yields nested wrappers — keep their
     natural vertical rhythm so bullet lists / address blocks don't collapse. */
  div { margin: 0; }
  br + br { display: block; content: ''; margin-top: 6px; }
`;

function buildReaderDoc(title: string, html: string): string {
  const safeTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
<base target="_blank">
<style>${READER_CSS}</style>
</head>
<body>
${title ? `<h1>${safeTitle}</h1>` : ''}
${html}
</body>
</html>`;
}

function ReaderArticle({ title, html }: { title: string; html: string }) {
  // Render inside an iframe srcdoc so the browser uses native UA layout +
  // our reset stylesheet — no inheritance from the app shell, no Tailwind v4
  // oklch colors leaking in. sandbox allows links to open (target=_blank via
  // <base>) but blocks scripts even if sanitizer missed one.
  const srcDoc = useMemo(() => buildReaderDoc(title, html), [title, html]);
  return (
    <iframe
      title={title || 'Job Description reader view'}
      srcDoc={srcDoc}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      className="h-[60vh] w-full border-0 bg-white"
    />
  );
}

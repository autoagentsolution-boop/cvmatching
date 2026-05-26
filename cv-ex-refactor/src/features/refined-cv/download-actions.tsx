'use client';

import { Button } from '@/components/ui';
import { useAnalysis } from '@/features/analyze/analysis-store';

/**
 * Locked decision #4: .md and .html downloads only. No PDF.
 * HTML download uses <pre>{markdown}</pre> inside a minimal HTML doctype —
 * KISS approach for Phase 1 (no extra deps, no server-side rendering).
 */
function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildHtmlDocument(markdown: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Refined CV</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a1a; }
    pre { white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>
  <pre>${markdown.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
}

export function DownloadActions() {
  const matchedCv = useAnalysis((s) => s.matchedCv);

  if (!matchedCv) return null;

  const timestamp = Date.now();

  function handleDownloadMd() {
    if (!matchedCv) return;
    triggerDownload(matchedCv, `refined-cv-${timestamp}.md`, 'text/markdown');
  }

  function handleDownloadHtml() {
    if (!matchedCv) return;
    triggerDownload(buildHtmlDocument(matchedCv), `refined-cv-${timestamp}.html`, 'text/html');
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={handleDownloadMd}>
        Download .md
      </Button>
      <Button variant="secondary" size="sm" onClick={handleDownloadHtml}>
        Download .html
      </Button>
    </div>
  );
}

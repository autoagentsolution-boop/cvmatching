'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { useSourceData } from './use-source-resolver';

/**
 * Downloads the generated CV in three formats per user request:
 *  - PDF:  client-side via html2canvas + jsPDF. Targets ONLY the rendered
 *          CV article (`.refined-cv-print-target article`) — not the
 *          surrounding app shell — so the saved file mirrors the on-screen
 *          page sheet, not the sidebar/topbar. Multi-page split when the
 *          rendered height exceeds one letter page (8.5 × 11in).
 *  - DOCX: client-side via the `docx` package. Renders paragraph-by-paragraph
 *          from a light markdown stripper. Heading-level lines get bold.
 *  - TXT:  strip the markdown formatting and download the bytes.
 */

function stripMarkdown(md: string): string {
  return md
    // ATX headings — drop leading #'s
    .replace(/^#{1,6}\s+/gm, '')
    // bold / italic / code
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    // links [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // bullets
    .replace(/^[\s]*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, '');
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadPdf(filename: string): Promise<void> {
  // Target the rendered <article> sheet inside `.refined-cv-print-target`.
  // We deliberately do NOT target the wrapper div — it contains the Edit
  // mode toolbar and centering scaffolding that shouldn't end up in the PDF.
  const target = document.querySelector<HTMLElement>(
    '.refined-cv-print-target article',
  );
  if (!target) {
    throw new Error('Refined CV article element not found in DOM.');
  }

  // Dynamic-import keeps these libs out of the main client chunk —
  // they're only needed when the user clicks PDF.
  //
  // We use `html-to-image` instead of `html2canvas` because Tailwind v4
  // emits modern CSS color spaces (oklch, color-mix) that html2canvas 1.x
  // can't parse — it throws "Attempting to parse an unsupported color
  // function" and bombs the export silently. html-to-image walks the DOM
  // via SVG <foreignObject>, which the browser renders natively, so any
  // CSS the browser understands works.
  const [{ toPng }, jsPdfMod] = await Promise.all([
    import('html-to-image'),
    import('jspdf'),
  ]);
  const JsPdf = jsPdfMod.jsPDF;

  // 2× pixel ratio so text stays crisp when downsampled into the PDF.
  // backgroundColor: white guarantees no transparent fill bleed.
  const dataUrl = await toPng(target, {
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    cacheBust: true,
  });

  // Measure the rendered article so we know the source aspect ratio.
  const img = await loadImage(dataUrl);

  // Letter page in points (jsPDF default unit): 612 × 792.
  const pdf = new JsPdf({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (img.height * imgWidth) / img.width;

  // Single-page fast path.
  if (imgHeight <= pageHeight) {
    pdf.addImage(dataUrl, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(filename);
    return;
  }

  // Multi-page: slide the same image upward each page so the next visible
  // chunk lands on the page. jsPDF clips to the page bounds automatically.
  let heightLeft = imgHeight;
  let yOffset = 0;
  pdf.addImage(dataUrl, 'PNG', 0, yOffset, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    yOffset -= pageHeight;
    pdf.addPage();
    pdf.addImage(dataUrl, 'PNG', 0, yOffset, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load rendered PNG.'));
    img.src = src;
  });
}

async function downloadDocx(markdown: string, filename: string): Promise<void> {
  // Dynamic import keeps the docx bundle out of the main client chunk.
  const { Document, Paragraph, TextRun, HeadingLevel, Packer } = await import('docx');
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const paragraphs = lines.map((raw) => {
    const line = raw.trimEnd();
    // H1/H2/H3
    if (/^#\s+/.test(line)) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: line.replace(/^#\s+/, ''), bold: true })],
      });
    }
    if (/^##\s+/.test(line)) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: line.replace(/^##\s+/, ''), bold: true })],
      });
    }
    if (/^###\s+/.test(line)) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: line.replace(/^###\s+/, ''), bold: true })],
      });
    }
    // Bullet
    if (/^[\s]*[-*+]\s+/.test(line)) {
      return new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun(line.replace(/^[\s]*[-*+]\s+/, ''))],
      });
    }
    // Plain text — strip remaining inline markdown
    return new Paragraph({ children: [new TextRun(stripMarkdown(line))] });
  });

  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, filename);
}

export function DownloadActions() {
  const { matchedCv } = useSourceData();
  const [pending, setPending] = useState<'pdf' | 'docx' | 'txt' | null>(null);

  if (!matchedCv) return null;

  const timestamp = Date.now();

  async function handleDownloadPdf(): Promise<void> {
    setPending('pdf');
    try {
      await downloadPdf(`refined-cv-${timestamp}.pdf`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[refined-cv] pdf export failed', e);
      alert(`Không xuất được PDF — ${msg}\n\nVui lòng thử lại hoặc dùng nút DOCX/TXT.`);
    } finally {
      setPending(null);
    }
  }

  async function handleDownloadDocx(): Promise<void> {
    if (!matchedCv) return;
    setPending('docx');
    try {
      await downloadDocx(matchedCv, `refined-cv-${timestamp}.docx`);
    } finally {
      setPending(null);
    }
  }

  function handleDownloadTxt(): void {
    if (!matchedCv) return;
    setPending('txt');
    const text = stripMarkdown(matchedCv);
    triggerDownload(new Blob([text], { type: 'text/plain' }), `refined-cv-${timestamp}.txt`);
    setPending(null);
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={handleDownloadPdf} loading={pending === 'pdf'}>
        PDF
      </Button>
      <Button variant="secondary" size="sm" onClick={() => void handleDownloadDocx()} loading={pending === 'docx'}>
        DOCX
      </Button>
      <Button variant="secondary" size="sm" onClick={handleDownloadTxt} loading={pending === 'txt'}>
        TXT
      </Button>
    </div>
  );
}

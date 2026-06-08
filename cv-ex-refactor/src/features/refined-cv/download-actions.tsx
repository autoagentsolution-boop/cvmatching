'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { useSourceData } from './use-source-resolver';

/**
 * Downloads the generated CV in three formats per user request:
 *  - PDF:  client-side via window.print() — uses the browser's "Save as PDF"
 *          flow against the @media print stylesheet. No new server endpoint,
 *          no headless Chromium. User picks the destination from the dialog.
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

  function handleDownloadPdf(): void {
    // window.print() opens the browser's Save-as-PDF dialog; the user picks
    // PDF as the destination. The @media print stylesheet on the rendered
    // CV controls the visual.
    setPending('pdf');
    window.print();
    // Print dialog is modal; reset state once user dismisses it (next tick).
    setTimeout(() => setPending(null), 1000);
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

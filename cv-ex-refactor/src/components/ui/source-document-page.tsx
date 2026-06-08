'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/cn';

export type SourceDocumentKind = 'cv' | 'jd';

export interface SourceDocumentPageProps {
  /** Raw parsed-text body (stripped of markup, just plain text). */
  content: string;
  /** Drives header label & default candidate-name detection. */
  kind?: SourceDocumentKind;
  /** Zoom factor (1 = 100%). Wrapper handles UI; we just apply transform. */
  zoom?: number;
  /** Override CSS — keep minimal; wrapper owns layout. */
  className?: string;
}

const SECTION_PATTERNS: Array<{ key: string; label: string; regex: RegExp }> = [
  { key: 'summary', label: 'Summary', regex: /^(professional\s+)?(summary|profile|objective|about\s+me|tóm\s*tắt|giới\s+thiệu)\s*:?\s*$/i },
  { key: 'experience', label: 'Experience', regex: /^(work\s+|professional\s+)?(experience|employment\s+history|kinh\s*nghiệm(\s+làm\s+việc)?)\s*:?\s*$/i },
  { key: 'education', label: 'Education', regex: /^(education|academic\s+background|học\s*vấn|trình\s+độ\s+học\s+vấn)\s*:?\s*$/i },
  { key: 'skills', label: 'Skills', regex: /^(technical\s+|core\s+|key\s+)?(skills|competencies|technologies|kỹ\s*năng)\s*:?\s*$/i },
  { key: 'projects', label: 'Projects', regex: /^(projects|personal\s+projects|portfolio|dự\s*án)\s*:?\s*$/i },
  { key: 'certifications', label: 'Certifications', regex: /^(certifications?|certificates?|awards?|chứng\s*chỉ|giải\s*thưởng)\s*:?\s*$/i },
  { key: 'languages', label: 'Languages', regex: /^(languages?|ngôn\s*ngữ)\s*:?\s*$/i },
  // JD-specific
  { key: 'responsibilities', label: 'Responsibilities', regex: /^(responsibilities|duties|what\s+you'?ll\s+do|trách\s*nhiệm|mô\s*tả\s*công\s*việc)\s*:?\s*$/i },
  { key: 'requirements', label: 'Requirements', regex: /^(requirements?|qualifications?|must[-\s]?haves?|what\s+we'?re\s+looking\s+for|yêu\s*cầu|yêu\s*cầu\s+ứng\s+viên)\s*:?\s*$/i },
  { key: 'nice-to-have', label: 'Nice to Have', regex: /^(nice[-\s]to[-\s]have|preferred|bonus|plus|ưu\s*tiên)\s*:?\s*$/i },
  { key: 'benefits', label: 'Benefits', regex: /^(benefits|perks|what\s+we\s+offer|quyền\s*lợi|phúc\s*lợi|chế\s*độ)\s*:?\s*$/i },
];

interface Section {
  key: string;
  label: string;
  lines: string[];
}

/**
 * Splits raw text into named sections by detecting common header lines.
 * Lines before the first detected header are bucketed into "header" (typically
 * contact info for a CV, title block for a JD).
 */
function segmentSections(content: string, kind: SourceDocumentKind): { header: string[]; sections: Section[] } {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const header: string[] = [];
  const sections: Section[] = [];
  let current: Section | null = null;
  let sawAnySection = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.length > 0 && trimmed.length <= 60) {
      const match = SECTION_PATTERNS.find((p) => p.regex.test(trimmed));
      if (match) {
        if (current) sections.push(current);
        current = { key: match.key, label: match.label, lines: [] };
        sawAnySection = true;
        continue;
      }
    }

    if (current) {
      current.lines.push(line);
    } else {
      header.push(line);
    }
  }

  if (current) sections.push(current);

  // If no headers detected at all, treat entire body as one untitled block
  // under a kind-appropriate fallback label so the visual still renders.
  if (!sawAnySection) {
    const fallbackLabel = kind === 'cv' ? 'Content' : 'Job Description';
    sections.push({ key: 'body', label: fallbackLabel, lines: header.splice(0) });
  }

  // Trim leading/trailing blank lines per section
  for (const s of sections) {
    while (s.lines.length && (s.lines[0] ?? '').trim() === '') s.lines.shift();
    while (s.lines.length && (s.lines[s.lines.length - 1] ?? '').trim() === '') s.lines.pop();
  }

  return { header, sections };
}

function isBulletLine(line: string): boolean {
  return /^[\s]*[-•·▪◦*]\s+/.test(line) || /^[\s]*\d+[.)]\s+/.test(line);
}

function stripBullet(line: string): string {
  return line.replace(/^[\s]*[-•·▪◦*]\s+/, '').replace(/^[\s]*\d+[.)]\s+/, '');
}

function renderSectionBody(lines: string[]): React.ReactNode {
  const groups: Array<{ type: 'bullets'; items: string[] } | { type: 'paragraph'; text: string }> = [];
  let currentBullets: string[] | null = null;
  let currentPara: string[] | null = null;

  const flush = () => {
    if (currentBullets) {
      groups.push({ type: 'bullets', items: currentBullets });
      currentBullets = null;
    }
    if (currentPara) {
      groups.push({ type: 'paragraph', text: currentPara.join(' ') });
      currentPara = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      flush();
      continue;
    }
    if (isBulletLine(line)) {
      if (currentPara) flush();
      currentBullets ??= [];
      currentBullets.push(stripBullet(line));
    } else {
      if (currentBullets) flush();
      currentPara ??= [];
      currentPara.push(trimmed);
    }
  }
  flush();

  return groups.map((g, i) => {
    if (g.type === 'bullets') {
      return (
        <ul key={i} className="ml-4 list-disc space-y-1.5">
          {g.items.map((item, j) => (
            <li key={j} className="leading-relaxed">{item}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} className="leading-relaxed">{g.text}</p>
    );
  });
}

/**
 * SourceDocumentPage — visual PDF/Word-style page render of parsed text.
 *
 * Owns: section regex, bullet/paragraph rendering, page CSS, zoom transform.
 * Does NOT own: header chrome (label, controls) — that's SourceDocumentCard.
 */
export function SourceDocumentPage({
  content,
  kind = 'cv',
  zoom = 1,
  className,
}: SourceDocumentPageProps) {
  const { header, sections } = useMemo(() => segmentSections(content, kind), [content, kind]);

  // Header lines: first non-blank line typically the name (for CV) or title (for JD)
  const trimmedHeader = header.filter((l) => l.trim() !== '');
  const titleLine = trimmedHeader[0] ?? '';
  const contactLines = trimmedHeader.slice(1);

  return (
    <div
      className={cn('flex justify-center', className)}
      style={{
        transform: zoom === 1 ? undefined : `scale(${zoom})`,
        transformOrigin: 'top center',
      }}
    >
      <article
        className={cn(
          'w-full max-w-[8.5in] bg-white text-neutral-900',
          'shadow-soft-lg ring-1 ring-black/5',
          'px-[0.75in] py-[0.75in]',
          'text-[12px] leading-[1.55]',
        )}
        // Arial — universal across OSes + full VN diacritic coverage.
        // Georgia/Times render ấ/ậ/ẫ/ằ/ẳ broken.
        style={{ fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif' }}
      >
        {titleLine && (
          <header className="mb-4 border-b border-neutral-300 pb-3 text-center">
            <h1 className="font-semibold tracking-wide text-[18px] uppercase text-neutral-900">
              {titleLine}
            </h1>
            {contactLines.length > 0 && (
              <p className="mt-1.5 text-[10.5px] text-neutral-600 leading-snug">
                {contactLines.join(' · ')}
              </p>
            )}
          </header>
        )}

        {sections.map((s) => (
          <section key={s.key} className="mb-4 last:mb-0">
            <h2 className="mb-1.5 border-b border-neutral-300 pb-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-800">
              {s.label}
            </h2>
            <div className="space-y-2 text-neutral-800">
              {renderSectionBody(s.lines)}
            </div>
          </section>
        ))}

        {!titleLine && sections.length === 0 && (
          <p className="text-center text-neutral-500 italic py-12">
            Document is empty.
          </p>
        )}
      </article>
    </div>
  );
}

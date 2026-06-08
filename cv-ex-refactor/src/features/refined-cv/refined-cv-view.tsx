'use client';

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Button, Card, MarkdownView } from '@/components/ui';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { useSourceData, useSourceSetters } from './use-source-resolver';
import { RedFlagsBanner } from './red-flags-banner';
import { RefinedCvModeBanner } from './refined-cv-mode-banner';
import { RefineToolsBlock } from './refine-tools-block';
import { RefinedCvEditor } from './refined-cv-editor';

/**
 * RefinedCvView — single-column orchestrator.
 *
 * Three states drive the render:
 *  1. no analyzeResult            → 'Run CV Analyze first' redirect card
 *  2. result, no matchedCv        → hint + Refine Controls (expanded)
 *  3. matchedCv present           → PDF-style page + collapsed Refine Controls
 *                                   + Edit / Save toggle on the rendered CV
 *
 * Aside is gone — the previous Match Score / Key Enhancements blocks were
 * duplicating content already on the CV Analyze step. Refine Controls now
 * sit in the main column so the user sees + actions them without scanning
 * across.
 */
export function RefinedCvView() {
  const { matchedCv, refineNotes, result, source } = useSourceData();
  const { setMatchedCv } = useSourceSetters(source);
  const isGeneratingCv = useAnalysis((s) => s.isGeneratingCv);

  // Locally-tracked expanded state; auto-collapse on a fresh generate.
  const [controlsOpen, setControlsOpen] = useState(true);
  const prevMatchedCvRef = useRef<string | null>(matchedCv);
  useEffect(() => {
    if (matchedCv && matchedCv !== prevMatchedCvRef.current) {
      // New generation landed — collapse the controls so the user sees the
      // result without scrolling past the form.
      setControlsOpen(false);
    }
    prevMatchedCvRef.current = matchedCv;
  }, [matchedCv]);

  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState('');

  const modeBanner = (
    <Suspense fallback={null}>
      <RefinedCvModeBanner />
    </Suspense>
  );

  // State 1 — no result yet. Redirect them to Analyze.
  if (!result) {
    return (
      <div className="flex flex-col gap-4">
        {modeBanner}
        <section className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-8">
          <div>
            <h2 className="font-display text-headline-md text-on-surface">Chưa có Refined CV</h2>
            <p className="mt-1 text-body-md text-on-surface-variant leading-relaxed">
              Refined CV là CV của bạn được tinh chỉnh — làm nổi bật điểm mạnh, sửa cách diễn đạt yếu, và tối ưu cho vai trò bạn nhắm tới. Hãy chạy Analyze trước.
            </p>
          </div>
          <Button asChild variant="primary">
            <Link href="/analyze">Bắt đầu ở Analyze →</Link>
          </Button>
        </section>
      </div>
    );
  }

  // State 2 — result present, no generation yet.
  if (!matchedCv) {
    return (
      <div className="flex flex-col gap-4">
        {modeBanner}
        <section className="flex flex-col gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-6">
          <h2 className="font-display text-headline-md text-on-surface">Sẵn sàng tạo Refined CV</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed">
            Phân tích đã có. Chọn tone + length + mode bên dưới rồi bấm Generate để tạo phiên bản tinh chỉnh. Bỏ trống — hệ thống dùng prompt mặc định.
          </p>
        </section>
        <RefineToolsBlock />
      </div>
    );
  }

  // State 3 — generated CV in hand.
  function handleEnterEdit(): void {
    // Seed draft with current markdown so Save without any edit is a no-op.
    setDraft(matchedCv ?? '');
    setEditMode(true);
  }
  function handleSaveEdit(): void {
    // Trim trailing blank lines turndown may leave behind.
    setMatchedCv(draft.replace(/\n{3,}/g, '\n\n').trimEnd());
    setEditMode(false);
  }
  function handleCancelEdit(): void {
    setEditMode(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {modeBanner}
      {result?.redFlags && <RedFlagsBanner redFlags={result.redFlags} />}

      {/* Generated CV — rendered as a PDF-like page sheet so output mirrors
          the Source CV format. Edit mode swaps the page for an editable
          textarea; Save writes back to the store. */}
      <div className="refined-cv-print-target">
        {editMode ? (
          <div className="flex flex-col gap-3 print:hidden">
            <RefinedCvEditor
              initialMarkdown={matchedCv}
              onMarkdownChange={(md) => setDraft(md)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleSaveEdit}>Save</Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <article
              // Arial: universally installed on every OS + full Vietnamese
              // glyph coverage (Georgia / Times have incomplete VN diacritic
              // support and render glyphs like ấ / ậ / ẫ / ằ / ẳ broken).
              // Predictable document look without webfont load.
              className="w-full max-w-[8.5in] rounded-lg bg-white text-neutral-900 shadow-soft-lg ring-1 ring-black/5 px-[0.75in] py-[0.75in]"
              style={{ fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif' }}
            >
              <MarkdownView markdown={matchedCv} variant="document" />
            </article>
          </div>
        )}
      </div>

      {/* Floating actions only when not editing */}
      {!editMode && (
        <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
          <Button variant="secondary" size="sm" onClick={handleEnterEdit}>
            Edit
          </Button>
        </div>
      )}

      {/* Refine Controls — collapsible accordion, auto-collapsed after a
          successful generate. User expands to re-tweak. */}
      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest print:hidden">
        <button
          type="button"
          onClick={() => setControlsOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          aria-expanded={controlsOpen}
        >
          <div className="flex flex-col">
            <span className="font-display text-title-md font-semibold text-on-surface">
              Refine Controls
            </span>
            <span className="text-label-sm text-on-surface-variant">
              {controlsOpen ? 'Adjust tone / length / mode then click Regenerate' : 'Click to tweak and regenerate'}
            </span>
          </div>
          <span
            className={`material-symbols-outlined text-on-surface-variant transition-transform ${controlsOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            expand_more
          </span>
        </button>
        {controlsOpen && (
          <div className="border-t border-outline-variant p-4">
            <RefineToolsBlock />
          </div>
        )}
      </section>

      {refineNotes && (
        <Card padding="lg" className="border-l-4 border-l-primary bg-surface-container-low print:hidden">
          <header className="mb-2 flex items-center gap-2">
            <span className="text-label-sm font-bold uppercase tracking-wide text-primary">
              Refine notes
            </span>
            <span className="text-label-sm text-on-surface-variant">
              · Chỉ cho bạn — KHÔNG nằm trong CV gửi recruiter
            </span>
          </header>
          <MarkdownView markdown={refineNotes} variant="document" />
        </Card>
      )}

      {isGeneratingCv && (
        <div className="rounded-xl border border-tertiary-container bg-tertiary-container/40 px-4 py-3 text-body-sm text-on-tertiary-container">
          Regenerating refined CV…
        </div>
      )}
    </div>
  );
}

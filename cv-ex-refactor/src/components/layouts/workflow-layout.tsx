'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { ChevronStepper } from '@/components/ui/chevron-stepper';
import { CvPickerChip } from '@/components/ui/cv-picker-chip';
import { SettingsDrawerTrigger } from '@/features/analyze/settings-drawer-trigger';
import { WorkflowSidebar } from './workflow-sidebar';
import type { WorkflowNavKey } from './workflow-sidebar';
import type { UserCvRow } from '@/lib/cvs/repo';

export type WorkflowType = 'cv-analyze' | 'jd-matching';

const CV_ANALYZE_STEPS = [
  { id: 'score', label: 'CV Analyze', href: '' },
  { id: 'refined', label: 'Refined CV', href: '' },
  { id: 'roadmap', label: 'Roadmap', href: '' },
  { id: 'jobfit', label: 'Job Fit', href: '' },
];

const JD_MATCHING_STEPS = [
  { id: 'match', label: 'JD Matching', href: '' },
  { id: 'refined', label: 'Refined CV', href: '' },
  { id: 'roadmap', label: 'Roadmap', href: '' },
  { id: 'jobfit', label: 'Job Fit', href: '' },
];

function buildSteps(workflow: WorkflowType, cvId: string, isAdmin: boolean) {
  const base = workflow === 'cv-analyze' ? CV_ANALYZE_STEPS : JD_MATCHING_STEPS;
  const prefix = workflow === 'cv-analyze' ? '/cv-analyze' : '/jd-matching';
  // Job Fit stays admin-only during pilot (job pool gating in /api/jobs/recommend).
  // Hide the chevron for non-admin to avoid dead-clicks into the 404 state.
  return base
    .filter((s) => isAdmin || s.id !== 'jobfit')
    .map((s) => ({
      ...s,
      href: `${prefix}/${cvId}/${s.id}`,
    }));
}

export interface WorkflowLayoutProps {
  workflow: WorkflowType;
  currentCvId: string;
  currentStepId: string;
  cvs: UserCvRow[];
  /** Left column: Source Document panel (Phase 3 provides real component). */
  sourceDocuments: ReactNode;
  /** Right column: step-specific main content. */
  children: ReactNode;
  /** Optional 3rd column right rail (analytics, tips, etc.). */
  optionalRightRail?: ReactNode;
  isAdmin?: boolean;
  isAuthed?: boolean;
}

/**
 * WorkflowLayout — shell for CV Analyze + JD Matching.
 *
 * Structure:
 *   [60px icon sidebar] | [main area]
 *                           [top bar: brand + CvPickerChip]
 *                           [ChevronStepper]
 *                           [2-col: source docs | step content]
 *                           [optional right rail]
 */
export function WorkflowLayout({
  workflow,
  currentCvId,
  currentStepId,
  cvs,
  sourceDocuments,
  children,
  optionalRightRail,
  isAdmin = false,
  isAuthed = false,
}: WorkflowLayoutProps) {
  const router = useRouter();
  const [showImportDrawer, setShowImportDrawer] = useState(false);
  const steps = buildSteps(workflow, currentCvId, isAdmin);
  const activeNav: WorkflowNavKey = workflow === 'cv-analyze' ? 'cv-analyze' : 'jd-matching';

  function handleSwitchCv(cvId: string) {
    // Navigate to same step for the new CV
    const prefix = workflow === 'cv-analyze' ? '/cv-analyze' : '/jd-matching';
    router.push(`${prefix}/${cvId}/${currentStepId}`);
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Icon sidebar */}
      <WorkflowSidebar activeNav={activeNav} isAdmin={isAdmin} isAuthed={isAuthed} />

      {/* Content area offset right of sidebar */}
      <div className="pl-[60px] flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-outline-variant bg-surface/90 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="font-display text-title-md font-bold text-primary hidden sm:block">
              Resume Refactor
            </span>
            <span className="hidden sm:inline text-on-surface-variant/40">·</span>
            <span className="text-label-md font-medium text-on-surface-variant capitalize">
              {workflow === 'cv-analyze' ? 'CV Analyze' : 'JD Matching'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <SettingsDrawerTrigger isAuthed={isAuthed} />
            <CvPickerChip
              currentCvId={currentCvId}
              cvs={cvs}
              onSwitchCv={handleSwitchCv}
              onCreateNew={() => setShowImportDrawer(true)}
            />
          </div>
        </header>

        {/* Chevron stepper */}
        <div className="border-b border-outline-variant bg-surface-container-low">
          <ChevronStepper
            steps={steps}
            currentStepId={currentStepId}
            className="max-w-none"
          />
        </div>

        {/* 2-column main content */}
        <main
          className={cn(
            'flex flex-1 gap-0',
            // 50/50 split when no right rail. With right rail keep Source at
            // 1fr but compress the 3-col layout. User explicitly asked for
            // wider Source panel so PDF / Word original render is readable.
            optionalRightRail ? 'xl:grid xl:grid-cols-[minmax(360px,1fr)_minmax(0,1.5fr)_minmax(240px,320px)]' : 'lg:grid lg:grid-cols-[minmax(360px,1fr)_minmax(0,1fr)]',
          )}
        >
          {/* Left: Source Document panel */}
          <aside className="hidden lg:flex flex-col border-r border-outline-variant bg-surface-container-lowest overflow-y-auto">
            <div className="sticky top-0 px-4 py-2 border-b border-outline-variant bg-surface-container-low">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Source Documents
              </span>
            </div>
            <div className="flex-1 p-4">
              {sourceDocuments}
            </div>
          </aside>

          {/* Right: step content */}
          <section className="flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-8">
            {children}
          </section>

          {/* Optional right rail */}
          {optionalRightRail && (
            <aside className="hidden xl:flex flex-col border-l border-outline-variant bg-surface-container-lowest overflow-y-auto p-4">
              {optionalRightRail}
            </aside>
          )}
        </main>
      </div>

      {/* Import drawer — Phase 3 will replace this stub */}
      {showImportDrawer && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-inverse-surface/40 backdrop-blur-sm"
          onClick={() => setShowImportDrawer(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-surface-container-lowest p-6 shadow-soft-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 font-display text-headline-md text-on-surface">New CV</h2>
            <p className="mb-4 text-body-sm text-on-surface-variant">
              Import a CV to get started. Head to{' '}
              <a href="/cvs" className="text-primary underline">My CVs</a> for full management.
            </p>
            <button
              type="button"
              onClick={() => setShowImportDrawer(false)}
              className="mt-2 w-full rounded-lg border border-outline-variant py-2.5 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-low"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

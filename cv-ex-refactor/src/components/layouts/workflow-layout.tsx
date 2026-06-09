'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { ChevronStepper } from '@/components/ui/chevron-stepper';
import { CvPickerChip } from '@/components/ui/cv-picker-chip';
import { SettingsDrawerTrigger } from '@/features/analyze/settings-drawer-trigger';
import { DashboardSidebar } from './dashboard-sidebar';
import type { ActiveNav } from './dashboard-sidebar';
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

/**
 * Derive active step id from the URL — WorkflowLayout lives in the
 * `/[cvId]/layout.tsx` segment which doesn't receive [step] params.
 */
function deriveStepFromPath(pathname: string, workflow: WorkflowType): string {
  const prefix = workflow === 'cv-analyze' ? '/cv-analyze/' : '/jd-matching/';
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : '';
  const step = rest.split('/')[1] ?? '';
  return step || (workflow === 'cv-analyze' ? 'score' : 'match');
}

function buildSteps(workflow: WorkflowType, cvId: string, isAdmin: boolean) {
  const base = workflow === 'cv-analyze' ? CV_ANALYZE_STEPS : JD_MATCHING_STEPS;
  const prefix = workflow === 'cv-analyze' ? '/cv-analyze' : '/jd-matching';
  // Job Fit stays admin-only during pilot (pool gating in /api/jobs/recommend).
  return base
    .filter((s) => isAdmin || s.id !== 'jobfit')
    .map((s) => ({ ...s, href: `${prefix}/${cvId}/${s.id}` }));
}

export interface WorkflowLayoutProps {
  workflow: WorkflowType;
  currentCvId: string;
  cvs: UserCvRow[];
  /** Source Document panel content. Position depends on sourceLayout. */
  sourceDocuments: ReactNode;
  /** Step-specific main content. Below or right of sourceDocuments. */
  children: ReactNode;
  /** Optional 3rd column right rail (analytics, tips, etc.). Only consumed
   *  when sourceLayout='left'. */
  optionalRightRail?: ReactNode;
  /**
   * Optional override for source-panel placement. When omitted, the layout
   * derives placement from (workflow, currentStepId):
   *  - CV Analyze → always 'left' (single CV source, vertical aside).
   *  - JD Matching → 'top' on /match (CV + JD side-by-side at top of main),
   *                  'left' on the downstream steps (CV-only, like CV
   *                  Analyze pattern).
   * Pass a literal here only to override that default. Functions are not
   * accepted because props must be serializable across the server→client
   * boundary; the auto-derive lives in this client component instead.
   */
  sourceLayout?: 'left' | 'top';
  isAdmin?: boolean;
  isAuthed?: boolean;
}

/**
 * WorkflowLayout — shell for CV Analyze + JD Matching.
 *
 * Shares the 256px DashboardSidebar with DashboardLayout (single nav source
 * of truth — same items, icons, active styling, mobile drawer). Adds a
 * workflow-specific topbar (CvPickerChip) + ChevronStepper + 2/3-column
 * source/content grid stacked underneath.
 */
export function WorkflowLayout({
  workflow,
  currentCvId,
  cvs,
  sourceDocuments,
  children,
  optionalRightRail,
  // NOTE: deliberately no default — undefined cascades into the
  // (workflow, currentStepId) auto-derive below. A default of 'left' here
  // would short-circuit the derive and break /match parallel layout.
  sourceLayout,
  isAdmin = false,
  isAuthed = false,
}: WorkflowLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentStepId = deriveStepFromPath(pathname, workflow);
  const [showImportDrawer, setShowImportDrawer] = useState(false);
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const steps = buildSteps(workflow, currentCvId, isAdmin);
  const activeNav: ActiveNav = workflow === 'cv-analyze' ? 'analyze' : 'jd-matching';
  const resolvedSourceLayout: 'left' | 'top' =
    sourceLayout ??
    (workflow === 'jd-matching' && currentStepId === 'match' ? 'top' : 'left');

  function handleSwitchCv(cvId: string) {
    const prefix = workflow === 'cv-analyze' ? '/cv-analyze' : '/jd-matching';
    router.push(`${prefix}/${cvId}/${currentStepId}`);
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Desktop sidebar — same 256px DashboardSidebar as the rest of the app */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-outline-variant bg-surface-container-low lg:flex"
        aria-label="Sidebar"
      >
        <DashboardSidebar activeNav={activeNav} isAdmin={isAdmin} isAuthed={isAuthed} />
      </aside>

      {/* Mobile/tablet drawer */}
      <Drawer
        open={navDrawerOpen}
        onClose={() => setNavDrawerOpen(false)}
        side="right"
        title="Navigation"
      >
        <DashboardSidebar
          activeNav={activeNav}
          isAdmin={isAdmin}
          isAuthed={isAuthed}
          onNavClick={() => setNavDrawerOpen(false)}
        />
      </Drawer>

      {/* Content area offset right of sidebar on desktop */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        {/* Workflow topbar — CvPicker + Settings; no brand wordmark (sidebar owns it) */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-outline-variant bg-surface/90 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Open navigation menu"
              className="lg:hidden"
              onClick={() => setNavDrawerOpen(true)}
            >
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                menu
              </span>
            </Button>
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

        {resolvedSourceLayout === 'top' ? (
          // Top-row variant: sources span the full main width at the top,
          // step content (and match results, etc.) flows below. Used by JD
          // Matching so CV + JD viewers sit side-by-side and the result
          // block stacks underneath for full-width reading.
          <main className="flex flex-1 flex-col">
            <div className="border-b border-outline-variant bg-surface-container-lowest px-4 py-4 md:px-6 lg:px-8">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Source Documents
              </div>
              {sourceDocuments}
            </div>
            <section className="flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-8">
              {children}
            </section>
          </main>
        ) : (
          // Default left-column variant: 2-col grid with sources as a tall
          // aside on the left. The minmax constraints keep both columns
          // readable down to a 1024px viewport (~256px chrome sidebar).
          <main
            className={cn(
              'flex flex-1 gap-0',
              optionalRightRail
                ? 'xl:grid xl:grid-cols-[minmax(360px,1fr)_minmax(0,1.5fr)_minmax(240px,320px)]'
                : 'lg:grid lg:grid-cols-[minmax(360px,1fr)_minmax(0,1fr)]',
            )}
          >
            <aside className="hidden flex-col overflow-y-auto border-r border-outline-variant bg-surface-container-lowest lg:flex">
              <div className="sticky top-0 border-b border-outline-variant bg-surface-container-low px-4 py-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Source Documents
                </span>
              </div>
              <div className="flex-1 p-4">{sourceDocuments}</div>
            </aside>

            <section className="flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-8">
              {children}
            </section>

            {optionalRightRail && (
              <aside className="hidden flex-col overflow-y-auto border-l border-outline-variant bg-surface-container-lowest p-4 xl:flex">
                {optionalRightRail}
              </aside>
            )}
          </main>
        )}
      </div>

      {/* Import drawer stub — full UX lives at /cvs */}
      {showImportDrawer && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-inverse-surface/40 backdrop-blur-sm sm:items-center"
          onClick={() => setShowImportDrawer(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-surface-container-lowest p-6 shadow-soft-lg sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 font-display text-headline-md text-on-surface">New CV</h2>
            <p className="mb-4 text-body-sm text-on-surface-variant">
              Import a CV to get started. Head to{' '}
              <a href="/cvs" className="text-primary underline">
                My CVs
              </a>{' '}
              for full management.
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

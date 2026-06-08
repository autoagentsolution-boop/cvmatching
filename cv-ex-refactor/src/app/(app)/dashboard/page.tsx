import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getSession } from '@/lib/get-session';
import { listUserCvs } from '@/lib/cvs/repo';
import { getDefaultCvId } from '@/lib/cvs/get-default-cv-id';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Dashboard — Resume Refactor' };

/** Format relative time without a heavy dependency (e.g. date-fns). */
function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect('/sign-in');

  const cvs = await listUserCvs(session.user.id);
  const defaultCvId = cvs.length > 0 ? (cvs.find((c) => c.isDefault)?.id ?? cvs[0]?.id ?? null) : null;

  return (
    <div className="mx-auto w-full max-w-[1040px] py-8 px-4 md:px-6">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-display text-display-sm font-bold text-on-surface">
          Welcome back
        </h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Choose a workflow to get started, or pick up where you left off.
        </p>
      </div>

      {/* 2 main action cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-10">
        <ActionCard
          icon="analytics"
          title="CV Analyze"
          description="Score your CV against a target role. Get 9-dimension breakdown, keyword gaps, and a refined version."
          cta="Start CV Analyze"
          href={defaultCvId ? `/cv-analyze/${defaultCvId}/score` : '/cvs'}
          noCvHint={!defaultCvId}
          variant="primary"
        />
        <ActionCard
          icon="compare_arrows"
          title="JD Matching"
          description="Paste a job description to score your CV against it. See must-have gaps and AI insights."
          cta="Start JD Matching"
          href={defaultCvId ? `/jd-matching/${defaultCvId}/match` : '/cvs'}
          noCvHint={!defaultCvId}
          variant="secondary"
        />
      </div>

      {/* Recent CVs section */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-title-md font-bold text-on-surface">Your CVs</h2>
          <Link
            href="/cvs"
            className="text-label-md font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:underline"
          >
            Manage all
          </Link>
        </div>

        {cvs.length === 0 ? (
          <EmptyState
            icon={
              <span className="material-symbols-outlined text-[32px]" aria-hidden="true">
                description
              </span>
            }
            title="No CVs yet"
            description="Import your first CV to start analyzing and refining."
            action={
              <Link
                href="/cvs"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-label-md font-bold text-on-primary shadow-soft transition-all hover:opacity-90"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
                Add your first CV
              </Link>
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cvs.slice(0, 6).map((cv) => (
              <li key={cv.id}>
                <Card variant="interactive" padding="md" as="div" className="h-full">
                  <div className="flex flex-col gap-2 h-full">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-on-surface text-body-md line-clamp-2 flex-1">
                        {cv.name}
                      </span>
                      {cv.isDefault && (
                        <span className="shrink-0 rounded-full bg-tertiary-fixed px-2 py-0.5 text-[10px] font-bold text-on-tertiary-fixed">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-label-sm text-on-surface-variant mt-auto">
                      Updated {formatRelative(new Date(cv.updatedAt))}
                    </p>
                    <div className="flex gap-2 mt-1">
                      <Link
                        href={`/cv-analyze/${cv.id}/score`}
                        className="flex-1 rounded-lg border border-outline-variant py-2 text-center text-label-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                      >
                        Analyze
                      </Link>
                      <Link
                        href={`/jd-matching/${cv.id}/match`}
                        className="flex-1 rounded-lg border border-outline-variant py-2 text-center text-label-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                      >
                        Match JD
                      </Link>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface ActionCardProps {
  icon: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  noCvHint: boolean;
  variant: 'primary' | 'secondary';
}

function ActionCard({ icon, title, description, cta, href, noCvHint, variant }: ActionCardProps) {
  const isPrimary = variant === 'primary';
  return (
    <div
      className={`rounded-2xl border p-6 flex flex-col gap-4 ${
        isPrimary
          ? 'border-primary/20 bg-primary-container/30'
          : 'border-outline-variant bg-surface-container-lowest'
      }`}
    >
      <div
        className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${
          isPrimary ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
        }`}
      >
        <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-title-md font-bold text-on-surface">{title}</h3>
        <p className="text-body-sm text-on-surface-variant">{description}</p>
        {noCvHint && (
          <p className="text-label-sm text-on-tertiary-container mt-1">
            You'll be asked to add a CV first.
          </p>
        )}
      </div>
      <Link
        href={href}
        className={`inline-flex items-center gap-2 self-start rounded-lg px-5 py-2.5 text-label-md font-bold transition-all hover:opacity-90 ${
          isPrimary
            ? 'bg-primary text-on-primary shadow-soft'
            : 'border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-high'
        }`}
      >
        {cta}
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          arrow_forward
        </span>
      </Link>
    </div>
  );
}

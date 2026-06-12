import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { MdArrowForward, MdAutoAwesome, MdEditDocument, MdInsights, MdRocketLaunch } from 'react-icons/md';
import { getSession } from '@/lib/get-session';
import { listUserCvs } from '@/lib/cvs/repo';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { HistoryWidget } from '@/features/interview/history-widget';

export const metadata: Metadata = { title: 'Dashboard — Resume Refactor' };

// Original landing pillars (preserved from pre-Phase-2 dashboard content).
const PILLARS = [
  {
    icon: MdAutoAwesome,
    title: 'Chọn đúng job',
    body: 'CV bạn được scan trên một pool job thật — kết quả tier S→E nói thẳng cái gì đáng apply, cái gì là stretch.',
  },
  {
    icon: MdEditDocument,
    title: 'Sửa đúng CV',
    body: 'Refine CV theo mode (Apply / Quick Fix / Stretch) cho từng job — không bịa kinh nghiệm, không lan man.',
  },
  {
    icon: MdInsights,
    title: 'Biết gap thật',
    body: 'Red flag + Gaps To Address tách riêng khỏi CV gửi recruiter. Bạn thấy đâu là điểm yếu, không phải recruiter.',
  },
  {
    icon: MdRocketLaunch,
    title: 'Tăng xác suất interview',
    body: 'Cover letter cụ thể theo JD + roadmap upskill khi job là stretch. Mỗi action chỉ tốn của bạn 1 click.',
  },
];

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

  const startCvAnalyzeHref = defaultCvId ? `/cv-analyze/${defaultCvId}/score` : '/cvs';
  const startJdMatchHref = defaultCvId ? `/jd-matching/${defaultCvId}/match` : '/cvs';

  return (
    <div className="mx-auto w-full max-w-[1080px] py-8 px-4 md:px-6">
      {/* Hero — preserves the original brand tagline + CTA */}
      <section
        aria-label="Tôn chỉ ứng dụng"
        className="relative overflow-hidden rounded-3xl border border-outline-variant bg-gradient-to-br from-tertiary-container via-surface-container-low to-surface px-8 py-14 sm:px-12 sm:py-20"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-on-tertiary-container/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-start gap-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface/80 px-4 py-1.5 text-label-md font-semibold text-on-surface-variant backdrop-blur">
            <MdAutoAwesome size={14} className="text-on-tertiary-container" aria-hidden="true" />
            AI + bạn = interview
          </span>
          <p className="max-w-2xl text-title-md font-medium leading-relaxed text-on-surface sm:text-headline-sm">
            AI giúp bạn{' '}
            <span className="font-bold text-on-tertiary-container">chọn đúng job</span>,{' '}
            <span className="font-bold text-on-tertiary-container">sửa đúng CV</span>,{' '}
            <span className="font-bold text-on-tertiary-container">biết gap thật</span>,
            và tăng xác suất được gọi phỏng vấn.
          </p>
          <h1 className="font-display text-[2.25rem] font-extrabold leading-[1.15] text-on-surface sm:text-[3rem] lg:text-[3.75rem]">
            Còn lại{' '}
            <span className="block text-on-tertiary-container underline decoration-on-tertiary-container/40 decoration-[3px] underline-offset-[6px]">
              vẫn là khả năng của bạn.
            </span>
          </h1>
          <div className="flex flex-wrap items-center gap-4 pt-4">
            <Link
              href={startCvAnalyzeHref}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-4 text-title-md font-bold text-on-primary shadow-soft transition-all hover:scale-[1.02] hover:opacity-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-tertiary-container/30"
              aria-label="Start Analyze — bắt đầu phân tích CV"
            >
              Start Analyze
              <MdArrowForward size={22} aria-hidden="true" />
            </Link>
            <p className="text-label-md text-on-surface-variant">
              Miễn phí · Không cần thẻ tín dụng
            </p>
          </div>
        </div>
      </section>

      {/* 2 workflow action cards — added by Phase 2 */}
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ActionCard
          icon="analytics"
          title="CV Analyze"
          description="Score your CV against a target role. Get 9-dimension breakdown, keyword gaps, and a refined version."
          cta="Start CV Analyze"
          href={startCvAnalyzeHref}
          noCvHint={!defaultCvId}
          variant="primary"
        />
        <ActionCard
          icon="compare_arrows"
          title="JD Matching"
          description="Paste a job description to score your CV against it. See must-have gaps and AI insights."
          cta="Start JD Matching"
          href={startJdMatchHref}
          noCvHint={!defaultCvId}
          variant="secondary"
        />
      </div>

      {/* 4 Pillars — preserved from original landing */}
      <section
        aria-label="4 cam kết"
        className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {PILLARS.map((p) => (
          <Card key={p.title} variant="default" padding="lg" className="flex flex-col gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-tertiary-container text-on-tertiary-container">
              <p.icon size={26} aria-hidden="true" />
            </span>
            <h2 className="font-display text-title-md font-bold text-on-surface">{p.title}</h2>
            <p className="text-body-md text-on-surface-variant">{p.body}</p>
          </Card>
        ))}
      </section>

      {/* Your CVs section — added by Phase 2 */}
      <section className="mt-10">
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

      {/* Recent interview practice sessions */}
      <section className="mt-10">
        <HistoryWidget userId={session.user.id} limit={5} />
      </section>

      {/* Secondary CTA — preserved from original landing */}
      <section className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-outline-variant p-8 text-center">
        <p className="text-body-md text-on-surface-variant">
          Sẵn sàng để xem CV bạn fit cỡ nào với job đang nhắm?
        </p>
        <Link
          href={startCvAnalyzeHref}
          className="inline-flex items-center gap-1.5 text-title-sm font-bold text-primary underline decoration-2 underline-offset-4 hover:opacity-80"
        >
          Bắt đầu Analyze ngay
          <MdArrowForward size={18} aria-hidden="true" />
        </Link>
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
            You&apos;ll be asked to add a CV first.
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

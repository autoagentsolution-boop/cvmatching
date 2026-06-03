import Link from 'next/link';
import { MdArrowForward, MdAutoAwesome, MdEditDocument, MdInsights, MdRocketLaunch } from 'react-icons/md';
import { Card } from '@/components/ui';

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

export function DashboardPage() {
  return (
    <>
      {/* Hero — rendered inside the AppShell's DashboardLayout main area;
          do NOT wrap with another DashboardLayout (causes double sidebar). */}
      <section
        aria-label="Tôn chỉ ứng dụng"
        className="relative overflow-hidden rounded-3xl border border-outline-variant bg-gradient-to-br from-tertiary-container via-surface-container-low to-surface px-8 py-14 sm:px-12 sm:py-20"
      >
        {/* Decorative blob */}
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

          <h1 className="font-display text-display-lg font-extrabold leading-[0.95] text-on-surface sm:text-[5.5rem]">
            Còn lại{' '}
            <span className="block text-on-tertiary-container underline decoration-on-tertiary-container/40 decoration-[6px] underline-offset-[10px]">
              vẫn là khả năng của bạn.
            </span>
          </h1>

          <div className="flex flex-wrap items-center gap-4 pt-4">
            <Link
              href="/analyze"
              className={[
                'inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-4',
                'text-title-md font-bold text-on-primary shadow-soft',
                'transition-all hover:scale-[1.02] hover:opacity-95',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-tertiary-container/30',
              ].join(' ')}
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

      {/* Pillars */}
      <section aria-label="4 cam kết" className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* Secondary CTA */}
      <section className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-outline-variant p-8 text-center">
        <p className="text-body-md text-on-surface-variant">
          Sẵn sàng để xem CV bạn fit cỡ nào với job đang nhắm?
        </p>
        <Link
          href="/analyze"
          className="inline-flex items-center gap-1.5 text-title-sm font-bold text-primary underline decoration-2 underline-offset-4 hover:opacity-80"
        >
          Bắt đầu Analyze ngay
          <MdArrowForward size={18} aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}

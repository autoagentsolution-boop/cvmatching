// Shared loading skeleton for /admin/* pages. Next.js shows this
// instantly on nav-click while the server component renders, so the
// user gets visual feedback during cold-start lambda or KV/PG fan-out
// instead of staring at the previous page.

export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-on-surface/10" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-on-surface/5" />
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="space-y-2 rounded-xl border border-outline-variant bg-surface-container-low p-4"
          >
            <div className="h-3 w-16 animate-pulse rounded bg-on-surface/10" />
            <div className="h-7 w-20 animate-pulse rounded bg-on-surface/15" />
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-low p-5">
        <div className="h-5 w-24 animate-pulse rounded bg-on-surface/10" />
        <div className="h-10 w-full animate-pulse rounded bg-on-surface/5" />
      </section>

      <section className="space-y-2">
        <div className="h-5 w-32 animate-pulse rounded bg-on-surface/10" />
        <div className="h-40 w-full animate-pulse rounded-xl border border-outline-variant bg-on-surface/5" />
      </section>
    </div>
  );
}

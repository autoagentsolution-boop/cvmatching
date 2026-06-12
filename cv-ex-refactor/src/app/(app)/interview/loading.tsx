export default function InterviewLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8 px-4 md:px-6">
      <header className="space-y-2">
        <div className="h-9 w-56 animate-pulse rounded-md bg-on-surface/10" />
        <div className="h-4 w-96 animate-pulse rounded-md bg-on-surface/5" />
      </header>

      <section className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-soft">
        <div className="h-10 w-full animate-pulse rounded-lg bg-on-surface/5" />
        <div className="h-12 w-full animate-pulse rounded-lg bg-on-surface/5" />
        <div className="h-12 w-full animate-pulse rounded-lg bg-on-surface/5" />
        <div className="h-12 w-full animate-pulse rounded-lg bg-on-surface/5" />
        <div className="h-12 w-full animate-pulse rounded-lg bg-on-surface/10" />
      </section>
    </div>
  );
}

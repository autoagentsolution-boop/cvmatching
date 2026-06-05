'use client';

import { useEffect, useState } from 'react';
import { Card, Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useSettings } from '@/features/analyze/settings-store';
import type { Company } from '@/lib/companies/types';

interface CompanyCardProps {
  companyId: string | undefined;
  /** Fallback display name when card is in loading state or stub. Typically `job.company`. */
  fallbackName?: string;
}

type FetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; company: Company }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string };

/**
 * Company card on Job Fit detail page. Client component — fetches Company
 * record via /api/companies/[slug] on mount. Renders one of:
 *  - hidden (no companyId)
 *  - skeleton (loading)
 *  - stub (tier1Pending=true → "Đang cập nhật")
 *  - empty (all Tier 1 fields absent → name only + soft note)
 *  - full (logo + name + industry/size/hq chips + website link)
 *
 * Phase 04 lite: ratings + enrichment intentionally absent — Phase 03 +
 * Phase 05 build those out behind the same API surface.
 */
type EnrichmentPhase = 'idle' | 'fetching' | 'failed';

export function CompanyCard({ companyId, fallbackName }: CompanyCardProps) {
  const [state, setState] = useState<FetchState>({ kind: 'idle' });
  const [enrichPhase, setEnrichPhase] = useState<EnrichmentPhase>('idle');
  const { provider, model, temperature, baseUrl } = useSettings();

  useEffect(() => {
    if (!companyId) {
      setState({ kind: 'idle' });
      return;
    }

    let cancelled = false;
    setState({ kind: 'loading' });

    fetch(`/api/companies/${encodeURIComponent(companyId)}`, { method: 'GET' })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setState({ kind: 'not-found' });
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setState({
            kind: 'error',
            message: body?.error?.message ?? `HTTP ${res.status}`,
          });
          return;
        }
        const body = (await res.json()) as { ok: true; company: Company };
        setState({ kind: 'ok', company: body.company });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState({
          kind: 'error',
          message: e instanceof Error ? e.message : 'Network error',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  // Lazy Tier 2 enrichment: once GET lands and company has no enrichment
  // (or stale), fire POST in background. On success, swap company state in
  // place — UI re-renders with enrichment section populated.
  useEffect(() => {
    if (state.kind !== 'ok') return;
    if (state.company.tier1.pending) return;
    if (enrichPhase !== 'idle') return;
    if (state.company.enrichment && !isEnrichmentStaleByDate(state.company.enrichment.enrichedAt)) return;

    let cancelled = false;
    setEnrichPhase('fetching');

    fetch(`/api/companies/${encodeURIComponent(state.company.slug)}/enrichment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        llm: { provider, model, temperature, ...(baseUrl ? { baseUrl } : {}) },
      }),
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setEnrichPhase('failed');
          return;
        }
        const body = (await res.json()) as { ok: true; company: Company };
        setState({ kind: 'ok', company: body.company });
        setEnrichPhase('idle');
      })
      .catch(() => {
        if (cancelled) return;
        setEnrichPhase('failed');
      });

    return () => {
      cancelled = true;
    };
  }, [state, enrichPhase, provider, model, temperature, baseUrl]);

  if (!companyId) return null;
  if (state.kind === 'idle') return null;
  if (state.kind === 'error') return null;
  if (state.kind === 'not-found') return null;

  if (state.kind === 'loading') {
    return <CompanyCardSkeleton />;
  }

  const company = state.company;
  if (company.tier1.pending) {
    return <CompanyCardStub name={company.tier1.displayName || fallbackName || company.canonicalName} />;
  }

  if (isAllTier1Empty(company)) {
    return <CompanyCardEmpty name={company.tier1.displayName || company.canonicalName} />;
  }

  return <CompanyCardFull company={company} enrichPhase={enrichPhase} />;
}

function CompanyCardSkeleton() {
  return (
    <Card padding="md" className="animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-lg bg-surface-container-highest" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-surface-container-highest" />
          <div className="h-3 w-1/3 rounded bg-surface-container-highest" />
        </div>
      </div>
    </Card>
  );
}

function CompanyCardStub({ name }: { name: string }) {
  return (
    <Card padding="md">
      <div className="flex items-center gap-3">
        <CompanyLogo logoUrl={undefined} name={name} />
        <div className="flex-1 min-w-0">
          <h3 className="text-title-md font-semibold truncate">{name}</h3>
          <p className="text-body-sm text-on-surface-variant">Đang cập nhật thông tin công ty</p>
        </div>
      </div>
    </Card>
  );
}

function CompanyCardEmpty({ name }: { name: string }) {
  return (
    <Card padding="md">
      <div className="flex items-center gap-3">
        <CompanyLogo logoUrl={undefined} name={name} />
        <div className="flex-1 min-w-0">
          <h3 className="text-title-md font-semibold truncate">{name}</h3>
          <p className="text-body-sm text-on-surface-variant">
            Công ty chưa có thông tin chi tiết công khai
          </p>
        </div>
      </div>
    </Card>
  );
}

function CompanyCardFull({
  company,
  enrichPhase,
}: {
  company: Company;
  enrichPhase: EnrichmentPhase;
}) {
  const { tier1, enrichment } = company;
  const name = tier1.displayName || company.canonicalName;
  const isStale = isTier1Stale(company.tier1ExpiresAt);

  return (
    <Card padding="md">
      <div className="flex items-start gap-4">
        <CompanyLogo logoUrl={tier1.logoUrl} name={name} />
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <h3 className="text-title-md font-semibold truncate">{name}</h3>
            {isStale && (
              <p className="text-label-sm text-on-surface-variant mt-0.5">
                Cập nhật {daysSince(company.tier1FetchedAt)} ngày trước
              </p>
            )}
          </div>
          {(tier1.industry || tier1.size || tier1.hq) && (
            <div className="flex flex-wrap gap-2">
              {tier1.industry && (
                <Badge variant="neutral" size="sm">
                  {tier1.industry}
                </Badge>
              )}
              {tier1.size && (
                <Badge variant="neutral" size="sm">
                  {tier1.size} nhân viên
                </Badge>
              )}
              {tier1.hq && (
                <Badge variant="neutral" size="sm">
                  {tier1.hq}
                </Badge>
              )}
            </div>
          )}
          {tier1.website && isSafeHttpUrl(tier1.website) && (
            <a
              href={tier1.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 text-label-md text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-tertiary-container/40 rounded"
            >
              {prettyDomain(tier1.website)}
              <span aria-hidden>↗</span>
            </a>
          )}
          {tier1.about && (
            <p className="text-body-sm text-on-surface-variant line-clamp-3">{tier1.about}</p>
          )}
        </div>
      </div>
      <EnrichmentSection enrichment={enrichment} phase={enrichPhase} />
    </Card>
  );
}

function CompanyLogo({ logoUrl, name }: { logoUrl: string | undefined; name: string }) {
  const [errored, setErrored] = useState(false);
  const initial = name.charAt(0).toUpperCase() || '?';

  if (!logoUrl || errored || !isSafeHttpUrl(logoUrl)) {
    return (
      <div
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg',
          'bg-secondary-container text-on-secondary-container font-bold',
        )}
        aria-label={`Logo công ty ${name}`}
      >
        {initial}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt={`Logo ${name}`}
      width={48}
      height={48}
      className="h-12 w-12 shrink-0 rounded-lg object-contain bg-surface-container-lowest"
      onError={() => setErrored(true)}
    />
  );
}

function EnrichmentSection({
  enrichment,
  phase,
}: {
  enrichment: Company['enrichment'];
  phase: EnrichmentPhase;
}) {
  // First-ever load: no enrichment + currently fetching → loader.
  if (!enrichment && phase === 'fetching') {
    return (
      <div className="mt-4 pt-4 border-t border-outline-variant/30">
        <p className="text-label-sm text-on-surface-variant animate-pulse">
          Đang phân tích thông tin công ty từ nguồn công khai...
        </p>
      </div>
    );
  }

  // POST failed silently — render nothing extra; user still has Tier 1.
  if (!enrichment) return null;

  const hasSummary = enrichment.summary.trim().length > 0;
  const hasPros = enrichment.pros.length > 0;
  const hasCons = enrichment.cons.length > 0;

  if (!hasSummary && !hasPros && !hasCons) {
    return enrichment.insufficientSources ? (
      <p className="mt-4 pt-4 border-t border-outline-variant/30 text-label-sm text-on-surface-variant">
        Chưa đủ nguồn công khai để tổng hợp phân tích chi tiết.
      </p>
    ) : null;
  }

  return (
    <div className="mt-4 pt-4 border-t border-outline-variant/30 space-y-4">
      {hasSummary && (
        <p className="text-body-sm text-on-surface leading-relaxed">{enrichment.summary}</p>
      )}
      {hasPros && (
        <div>
          <h4 className="text-label-md font-semibold text-on-surface mb-2">Điểm sáng</h4>
          <ul className="space-y-1.5">
            {enrichment.pros.map((claim, i) => (
              <li key={i} className="text-body-sm text-on-surface-variant flex items-start gap-2">
                <span className="text-secondary mt-0.5 shrink-0" aria-hidden>
                  +
                </span>
                <span className="flex-1">
                  {claim.text}
                  <CitationChipList citations={claim.citations} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {hasCons && (
        <div>
          <h4 className="text-label-md font-semibold text-on-surface mb-2">Cần lưu ý</h4>
          <ul className="space-y-1.5">
            {enrichment.cons.map((claim, i) => (
              <li key={i} className="text-body-sm text-on-surface-variant flex items-start gap-2">
                <span className="text-error mt-0.5 shrink-0" aria-hidden>
                  !
                </span>
                <span className="flex-1">
                  {claim.text}
                  <CitationChipList citations={claim.citations} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CitationChipList({
  citations,
}: {
  citations: NonNullable<Company['enrichment']>['pros'][number]['citations'];
}) {
  if (citations.length === 0) return null;
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1">
      {citations.map((c, i) =>
        isSafeHttpUrl(c.url) ? (
          <a
            key={i}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center text-label-sm text-primary hover:underline rounded px-1 py-0.5 bg-surface-container-highest"
            title={c.label}
          >
            {c.label.length > 24 ? c.label.slice(0, 24) + '…' : c.label}
          </a>
        ) : null,
      )}
    </span>
  );
}

/** Local mirror of lib/companies/enrichment.ts isEnrichmentStale — avoids importing that server module into client bundle. */
function isEnrichmentStaleByDate(enrichedAt: string): boolean {
  const t = Date.parse(enrichedAt);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > 30 * 24 * 60 * 60 * 1000;
}

export function isAllTier1Empty(company: Company): boolean {
  const t = company.tier1;
  return !t.industry && !t.size && !t.hq && !t.website && !t.logoUrl && !t.about;
}

export function isTier1Stale(expiresAt: string | undefined): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return !Number.isNaN(t) && t < Date.now();
}

export function daysSince(isoTimestamp: string | undefined): number {
  if (!isoTimestamp) return 0;
  const t = Date.parse(isoTimestamp);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000)));
}

export function isSafeHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function prettyDomain(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch {
    return raw;
  }
}

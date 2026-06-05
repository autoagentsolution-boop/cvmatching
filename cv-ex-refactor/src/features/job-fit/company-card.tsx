'use client';

import { useEffect, useState } from 'react';
import { Card, Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
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
export function CompanyCard({ companyId, fallbackName }: CompanyCardProps) {
  const [state, setState] = useState<FetchState>({ kind: 'idle' });

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

  return <CompanyCardFull company={company} />;
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

function CompanyCardFull({ company }: { company: Company }) {
  const { tier1 } = company;
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

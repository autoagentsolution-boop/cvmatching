'use client';

import { useState } from 'react';

interface TriggerResponse {
  ok: boolean;
  dispatchedAt?: string;
  runsUrl?: string;
  error?: { code: string; message: string };
}

export function PoolTriggerButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    kind: 'ok' | 'err';
    message: string;
    runsUrl?: string;
  } | null>(null);
  const [pages, setPages] = useState('3');
  const [maxAgeDays, setMaxAgeDays] = useState('3');

  async function trigger(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/pool/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: Number(pages),
          maxAgeDays: Number(maxAgeDays),
        }),
      });
      const data = (await res.json()) as TriggerResponse;
      if (res.ok && data.ok) {
        setResult({
          kind: 'ok',
          message: 'Đã dispatch. Workflow sẽ chạy trên GitHub Actions (~25-40 phút).',
          ...(data.runsUrl ? { runsUrl: data.runsUrl } : {}),
        });
      } else {
        setResult({
          kind: 'err',
          message: data.error?.message ?? `HTTP ${res.status}: dispatch thất bại`,
        });
      }
    } catch (err) {
      setResult({
        kind: 'err',
        message: `Lỗi mạng: ${err instanceof Error ? err.message : 'unknown'}`,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-label-md text-on-surface-variant">
          Pages:
          <input
            type="number"
            min={1}
            max={5}
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            disabled={busy}
            className="w-16 rounded-md border border-outline-variant bg-surface px-2 py-1 text-body-md text-on-surface focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-label-md text-on-surface-variant">
          Max age (ngày):
          <input
            type="number"
            min={1}
            max={14}
            value={maxAgeDays}
            onChange={(e) => setMaxAgeDays(e.target.value)}
            disabled={busy}
            className="w-16 rounded-md border border-outline-variant bg-surface px-2 py-1 text-body-md text-on-surface focus:border-primary focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={trigger}
          disabled={busy}
          className="rounded-lg bg-primary px-4 py-2 text-label-lg font-medium text-on-primary transition hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? 'Đang dispatch…' : 'Refresh now ▶'}
        </button>
      </div>

      {result && (
        <div
          className={
            result.kind === 'ok'
              ? 'rounded-lg bg-tertiary-container p-3 text-body-sm text-on-tertiary-container'
              : 'rounded-lg bg-error-container p-3 text-body-sm text-on-error-container'
          }
        >
          {result.message}
          {result.runsUrl && (
            <>
              {' '}
              <a href={result.runsUrl} target="_blank" rel="noopener noreferrer" className="underline">
                Xem live trên GitHub Actions ↗
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}

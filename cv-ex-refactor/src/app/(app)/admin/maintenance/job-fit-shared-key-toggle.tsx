'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui';

interface Props {
  initiallyOn: boolean;
}

export function JobFitSharedKeyToggle({ initiallyOn }: Props) {
  const [isOn, setIsOn] = useState(initiallyOn);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function flip(action: 'on' | 'off') {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/job-fit-shared-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? `HTTP ${res.status}`);
        }
        setIsOn(action === 'on');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4">
        <div className="flex flex-col gap-1">
          <span className="text-label-md font-semibold text-on-surface">
            Job Fit shared key {isOn ? '— ON' : '— off'}
          </span>
          <span className="text-body-sm text-on-surface-variant">
            {isOn
              ? 'Non-admin signed-in users dùng shared Gemini key cho /job-fit ngay cả khi DISABLE_SHARED_KEY=1. Cost-bucket + per-user quota vẫn áp dụng. Heavy endpoints (analyze, generate-cv) vẫn bị block.'
              : 'Job Fit follows normal DISABLE_SHARED_KEY rules — khi env gate ON, non-admin bị 503 cho recommend.'}
          </span>
        </div>
        {isOn ? (
          <Button
            variant="secondary"
            size="md"
            onClick={() => flip('off')}
            loading={pending}
            disabled={pending}
          >
            Tắt bypass
          </Button>
        ) : (
          <Button
            variant="primary"
            size="md"
            onClick={() => flip('on')}
            loading={pending}
            disabled={pending}
          >
            Bật bypass
          </Button>
        )}
      </div>
      {error && (
        <p className="text-label-sm text-error" role="alert">
          Lỗi: {error}
        </p>
      )}
    </div>
  );
}

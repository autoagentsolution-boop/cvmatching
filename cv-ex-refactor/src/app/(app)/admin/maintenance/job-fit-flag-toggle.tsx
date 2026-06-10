'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui';

interface Props {
  initiallyOn: boolean;
}

export function JobFitFlagToggle({ initiallyOn }: Props) {
  const [isOn, setIsOn] = useState(initiallyOn);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function flip(action: 'on' | 'off') {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/job-fit-flag', {
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
            Job Fit {isOn ? '— ON' : '— off (hidden)'}
          </span>
          <span className="text-body-sm text-on-surface-variant">
            {isOn
              ? 'Job Fit reachable: workflow chevrons hiển thị step, /job-fit page render bình thường, /api/jobs/recommend nhận traffic. Tắt khi pilot có lỗi pool / Gemini / cost-bucket.'
              : 'Job Fit ẨN hoàn toàn: chevron drop step, /job-fit page render maintenance state, /api/jobs/recommend trả 503 (kể cả admin để test). Cost-bucket + per-user quota không tăng vì traffic không vào.'}
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
            Tắt Job Fit
          </Button>
        ) : (
          <Button
            variant="primary"
            size="md"
            onClick={() => flip('on')}
            loading={pending}
            disabled={pending}
          >
            Bật Job Fit
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

'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui';

interface MaintenanceToggleProps {
  initiallyOn: boolean;
}

export function MaintenanceToggle({ initiallyOn }: MaintenanceToggleProps) {
  const [isOn, setIsOn] = useState(initiallyOn);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function flip(action: 'on' | 'off') {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/maintenance', {
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
            Maintenance mode {isOn ? '— ON' : '— off'}
          </span>
          <span className="text-body-sm text-on-surface-variant">
            {isOn
              ? 'Page navigations đang trả 503. Admin diagnostic endpoints (/api/whoami, /api/health) vẫn chạy.'
              : 'Site đang live. Bật để chặn user (mất ~5s propagate do in-process cache).'}
          </span>
        </div>
        {isOn ? (
          <Button
            variant="primary"
            size="md"
            onClick={() => flip('off')}
            loading={pending}
            disabled={pending}
          >
            Tắt maintenance
          </Button>
        ) : (
          <Button
            variant="destructive"
            size="md"
            onClick={() => flip('on')}
            loading={pending}
            disabled={pending}
          >
            Bật maintenance
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

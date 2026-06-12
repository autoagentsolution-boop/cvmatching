'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui';

interface Props {
  initiallyOn: boolean;
}

export function InterviewFlagToggle({ initiallyOn }: Props) {
  const [isOn, setIsOn] = useState(initiallyOn);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function flip(action: 'on' | 'off') {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/interview-flag', {
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
            Luyện phỏng vấn {isOn ? '— ON' : '— off (hidden)'}
          </span>
          <span className="text-body-sm text-on-surface-variant">
            {isOn
              ? 'Luyện phỏng vấn reachable: sidebar nav hiển thị, /interview render bình thường, /api/interview/* nhận traffic (BYOK-only — kể cả admin). Tắt khi feature có lỗi hoặc cần pause.'
              : 'Luyện phỏng vấn ẨN hoàn toàn: sidebar nav drop entry, /interview/* trả 404, /api/interview/* trả 503 (kể cả admin để test). Existing sessions không bị xóa — chỉ ẩn UI + block API.'}
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
            Tắt Luyện phỏng vấn
          </Button>
        ) : (
          <Button
            variant="primary"
            size="md"
            onClick={() => flip('on')}
            loading={pending}
            disabled={pending}
          >
            Bật Luyện phỏng vấn
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

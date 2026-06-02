'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui';

interface LoginFlagToggleProps {
  initiallyOn: boolean;
}

export function LoginFlagToggle({ initiallyOn }: LoginFlagToggleProps) {
  const [isOn, setIsOn] = useState(initiallyOn);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function flip(action: 'on' | 'off') {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/login-flag', {
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
            Public login {isOn ? '— ON' : '— off'}
          </span>
          <span className="text-body-sm text-on-surface-variant">
            {isOn
              ? '/sign-in URL accessible, "Đăng nhập Google" button hiển thị trên topnav.'
              : '/sign-in URL trả 404 (kể cả khi đoán đúng path), không có button đăng nhập trên topnav. Admin vẫn login được vì admin session đã có sẵn.'}
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
            Tắt login
          </Button>
        ) : (
          <Button
            variant="primary"
            size="md"
            onClick={() => flip('on')}
            loading={pending}
            disabled={pending}
          >
            Bật login
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

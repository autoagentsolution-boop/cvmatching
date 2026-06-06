'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button, Card } from '@/components/ui';

interface CheckoutResponse {
  orderId: string;
  amountVnd: number;
  content: string;
  qrUrl: string;
  bank: { accountNumber: string; accountName: string; bankName: string };
  expiresAt: string;
}

type Status = 'idle' | 'creating' | 'awaiting-transfer' | 'completed' | 'expired' | 'error';

const POLL_MS = 3_000;
const MAX_POLL_MS = 10 * 60 * 1000;

function formatVND(n: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}

export function UpgradeClient({ priceVnd, userEmail }: { priceVnd: number; userEmail: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [order, setOrder] = useState<CheckoutResponse | null>(null);
  const pollStartRef = useRef<number | null>(null);

  async function createOrder() {
    setStatus('creating');
    setErrMsg(null);
    try {
      const res = await fetch('/api/checkout/sepay', { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as CheckoutResponse;
      setOrder(data);
      setStatus('awaiting-transfer');
      pollStartRef.current = Date.now();
    } catch (err) {
      setStatus('error');
      setErrMsg(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  useEffect(() => {
    if (status !== 'awaiting-transfer' || !order) return;

    let cancelled = false;
    const timer = setInterval(async () => {
      if (cancelled) return;

      if (pollStartRef.current && Date.now() - pollStartRef.current > MAX_POLL_MS) {
        setStatus('expired');
        clearInterval(timer);
        return;
      }

      try {
        const res = await fetch(`/api/orders/${order.orderId}/status`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { status: string };
        if (data.status === 'completed') {
          if (!cancelled) {
            setStatus('completed');
            clearInterval(timer);
            setTimeout(() => router.push('/job-fit?msg=upgraded'), 1500);
          }
        } else if (data.status === 'expired') {
          if (!cancelled) {
            setStatus('expired');
            clearInterval(timer);
          }
        }
      } catch {
        // transient — keep polling
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [status, order, router]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-display-sm font-bold text-on-surface">Upgrade to Pro</h1>
        <p className="text-body-md text-on-surface-variant">
          Unlock 5–10 personalized job matches per refresh, including top-tier (S/A) recommendations.
          One-time monthly bank transfer — no card, no auto-renewal.
        </p>
      </header>

      {status === 'idle' && (
        <Card className="space-y-4 p-6">
          <div className="space-y-1">
            <div className="text-headline-md font-semibold text-on-surface">Pro plan</div>
            <div className="text-display-sm font-bold text-primary">{formatVND(priceVnd)} / month</div>
          </div>
          <ul className="space-y-1 text-body-md text-on-surface-variant">
            <li>• 5–10 jobs per refresh (vs. 1–2 free)</li>
            <li>• Tier S + A jobs included</li>
            <li>• Persistent 90-day dedup so you never see the same job twice</li>
          </ul>
          {userEmail && (
            <p className="text-body-sm text-on-surface-variant">
              Activating for <strong>{userEmail}</strong>.
            </p>
          )}
          <Button onClick={createOrder}>Continue to payment</Button>
        </Card>
      )}

      {status === 'creating' && (
        <Card className="p-6 text-body-md text-on-surface-variant">Creating order…</Card>
      )}

      {status === 'error' && (
        <Card className="space-y-4 p-6">
          <p className="text-body-md text-error">Could not create order: {errMsg}</p>
          <Button variant="secondary" onClick={() => setStatus('idle')}>Try again</Button>
        </Card>
      )}

      {(status === 'awaiting-transfer' || status === 'completed' || status === 'expired') && order && (
        <Card className="space-y-6 p-6">
          {status === 'completed' && (
            <div className="rounded-lg bg-primary/10 p-4 text-body-md text-primary">
              ✓ Payment received. Activating Pro and redirecting…
            </div>
          )}
          {status === 'expired' && (
            <div className="space-y-2 rounded-lg bg-error/10 p-4 text-body-md text-error">
              <p>This order expired. If you already transferred, your subscription will still activate
              automatically when the bank confirms — refresh or check back in a few minutes.</p>
              <Button variant="secondary" size="sm" onClick={createOrder}>Create new order</Button>
            </div>
          )}

          <div className="flex flex-col items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Image
              src={order.qrUrl}
              alt="VietQR payment code"
              width={280}
              height={280}
              unoptimized
              className="rounded-lg border border-outline-variant"
            />
            <p className="text-center text-body-sm text-on-surface-variant">
              Open your banking app → Scan QR → Confirm transfer
            </p>
          </div>

          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 rounded-lg bg-surface-variant p-4 text-body-sm">
            <dt className="font-medium text-on-surface">Bank</dt>
            <dd className="text-on-surface-variant">{order.bank.bankName}</dd>
            <dt className="font-medium text-on-surface">Account number</dt>
            <dd className="font-mono text-on-surface-variant">{order.bank.accountNumber}</dd>
            <dt className="font-medium text-on-surface">Account name</dt>
            <dd className="text-on-surface-variant">{order.bank.accountName}</dd>
            <dt className="font-medium text-on-surface">Amount</dt>
            <dd className="font-semibold text-on-surface-variant">{formatVND(order.amountVnd)}</dd>
            <dt className="font-medium text-on-surface">Transfer memo</dt>
            <dd className="font-mono text-on-surface-variant">{order.content}</dd>
          </dl>

          <div className="space-y-2 text-body-sm text-on-surface-variant">
            <p>
              <strong>Important:</strong> the memo <code className="font-mono">{order.content}</code> must
              be copied exactly so we can match your transfer automatically. Some banks strip dashes — we
              handle that, but the rest of the memo must be unchanged.
            </p>
            <p>
              <strong>Quan trọng:</strong> sao chép nguyên văn nội dung chuyển khoản{' '}
              <code className="font-mono">{order.content}</code> để hệ thống đối soát tự động.
            </p>
          </div>

          {status === 'awaiting-transfer' && (
            <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
              Waiting for bank confirmation… (checking every 3s, up to 10 min)
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

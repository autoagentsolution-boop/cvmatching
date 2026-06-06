'use client';

import { useState } from 'react';
import { MdRefresh, MdUploadFile } from 'react-icons/md';
import Link from 'next/link';
import { Button, Card } from '@/components/ui';
import { resetSeenJobs } from './api-client';
import { clearSeenIds } from '@/lib/client/anon-seen';

interface Props {
  // Whether server already persisted the seen list (signed-in users) or only
  // the client holds it (anon users → sessionStorage). Drives which reset path
  // we run.
  seenPolicy: 'persisted' | 'client' | null;
  // 'no_more_new_matches' → user has seen jobs and pool is now exhausted
  // 'pool_empty'          → vertical has zero jobs in DB; user is brand-new
  reason: 'no_more_new_matches' | 'pool_empty';
  // Re-run the recommend call after a successful reset.
  onAfterReset: () => void;
}

export function ExhaustedPoolBanner({ seenPolicy, reason, onAfterReset }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleReset() {
    setBusy(true);
    setErr(null);
    try {
      if (seenPolicy === 'persisted') {
        await resetSeenJobs();
      }
      // Always clear anon storage too — covers users who signed in mid-session.
      clearSeenIds();
      onAfterReset();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Reset thất bại.');
    } finally {
      setBusy(false);
    }
  }

  if (reason === 'pool_empty') {
    return (
      <Card padding="lg" className="flex flex-col gap-3 border-dashed">
        <h3 className="text-title-md font-bold text-on-surface">
          Chưa có job nào trong vertical của bạn
        </h3>
        <p className="text-body-sm text-on-surface-variant">
          Hệ thống đang ingest jobs mới mỗi ngày. Quay lại sau 24h, hoặc thử upload một CV
          khác (vertical khác) để xem matches.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary" size="sm" leadingIcon={<MdUploadFile aria-hidden="true" />}>
            <Link href="/analyze">Upload CV khác</Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="flex flex-col gap-3 border-dashed">
      <h3 className="text-title-md font-bold text-on-surface">
        Bạn đã xem hết các job phù hợp
      </h3>
      <p className="text-body-sm text-on-surface-variant">
        Hệ thống sẽ ingest jobs mới mỗi ngày — quay lại mai để có thêm matches. Hoặc bấm{' '}
        <strong>Reset seen jobs</strong> để xem lại những job đã hiển thị trước đó.
      </p>
      {err && <p className="text-body-sm text-error">{err}</p>}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleReset}
          disabled={busy}
          leadingIcon={<MdRefresh aria-hidden="true" />}
        >
          {busy ? 'Đang reset…' : 'Reset seen jobs'}
        </Button>
        <Button asChild variant="ghost" size="sm" leadingIcon={<MdUploadFile aria-hidden="true" />}>
          <Link href="/analyze">Thử CV khác</Link>
        </Button>
      </div>
    </Card>
  );
}

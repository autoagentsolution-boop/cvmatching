'use client';

import { useEffect, useState } from 'react';

interface VisitStats {
  total: number;
  totalUnique: number;
  today: number;
  todayUnique: number;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat('vi-VN').format(n);
}

export function VisitsBadge() {
  const [stats, setStats] = useState<VisitStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/visits', { credentials: 'omit' });
        if (!res.ok) return;
        const data = (await res.json()) as VisitStats;
        if (!cancelled) setStats(data);
      } catch {
        // silent — non-critical
      }
    }
    load();
    // Light polling so the badge updates while admin watches it.
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!stats || stats.totalUnique === 0) return null;

  return (
    <div
      className="hidden items-center gap-2 rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 text-label-sm text-on-surface-variant md:flex"
      title={`Hôm nay: ${formatCount(stats.todayUnique)} unique / ${formatCount(stats.today)} lượt xem`}
      aria-label="Visit stats"
    >
      <span className="material-symbols-outlined text-[16px] leading-none" aria-hidden="true">
        visibility
      </span>
      <span>
        <span className="font-bold text-on-surface">{formatCount(stats.totalUnique)}</span>
        <span className="opacity-60"> người dùng</span>
      </span>
    </div>
  );
}

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

  if (!stats || stats.total === 0) return null;

  // Always show total page views as the headline number — it grows
  // monotonically and matches the colloquial "số lượt truy cập" reading.
  // Unique count lives in the tooltip; it's useful info but introduces
  // confusion as a headline because it started over when SADD-based
  // dedup landed mid-pilot.
  return (
    <div
      className="hidden items-center gap-2 rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 text-label-sm text-on-surface-variant md:flex"
      title={`Tổng: ${formatCount(stats.total)} lượt xem · ${formatCount(stats.totalUnique)} người dùng · Hôm nay: ${formatCount(stats.today)} lượt / ${formatCount(stats.todayUnique)} người`}
      aria-label="Visit stats"
    >
      <span className="material-symbols-outlined text-[16px] leading-none" aria-hidden="true">
        visibility
      </span>
      <span>
        <span className="font-bold text-on-surface">{formatCount(stats.total)}</span>
        <span className="opacity-60"> lượt truy cập</span>
      </span>
    </div>
  );
}

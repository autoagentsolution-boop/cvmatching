'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { useSettings } from '@/features/analyze/settings-store';
import { useCareerPath } from '@/features/career-path/career-path-store';

interface KindStatus {
  used: number;
  limit: number;
  remaining: number;
}

interface QuotaPayload {
  ok: boolean;
  scope?: 'user' | 'anon';
  enforced?: boolean;
  kinds?: {
    analyze: KindStatus;
    'generate-cv': KindStatus;
    'career-path': KindStatus;
  };
}

export function QuotaBadge({ isAuthed: _isAuthed }: { isAuthed: boolean }) {
  const hasRegisteredKey = useSettings((s) => s.hasRegisteredKey);
  const result = useAnalysis((s) => s.result);
  const matchedCv = useAnalysis((s) => s.matchedCv);
  const careerResult = useCareerPath((s) => s.result);

  const [status, setStatus] = useState<QuotaPayload | null>(null);

  const refresh = useCallback(async () => {
    if (hasRegisteredKey) return;
    try {
      const res = await fetch('/api/quota');
      if (!res.ok) return;
      const data = (await res.json()) as QuotaPayload;
      setStatus(data);
    } catch {
      // silent — quota badge is non-critical
    }
  }, [hasRegisteredKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [result, matchedCv, careerResult, refresh]);

  if (hasRegisteredKey) return null;
  if (!status?.ok || status.enforced === false || !status.kinds) return null;

  const a = status.kinds.analyze;
  const g = status.kinds['generate-cv'];
  const c = status.kinds['career-path'];

  return (
    <div
      className="hidden items-center gap-3 rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 text-label-sm text-on-surface-variant md:flex"
      aria-label="Daily quota status"
    >
      <span title="Analyses today">
        <span className="font-bold text-on-surface">{a.used}</span>
        <span className="opacity-60">/{a.limit}</span>{' '}
        <span className="opacity-60">analyses</span>
      </span>
      <span className="text-outline">·</span>
      <span title="CV rewrites today">
        <span className="font-bold text-on-surface">{g.used}</span>
        <span className="opacity-60">/{g.limit}</span>{' '}
        <span className="opacity-60">rewrites</span>
      </span>
      {c && (
        <>
          <span className="text-outline">·</span>
          <span title="Career roadmaps today">
            <span className="font-bold text-on-surface">{c.used}</span>
            <span className="opacity-60">/{c.limit}</span>{' '}
            <span className="opacity-60">paths</span>
          </span>
        </>
      )}
    </div>
  );
}

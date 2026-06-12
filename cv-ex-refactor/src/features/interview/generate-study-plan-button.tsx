// Client wrapper around the study-plan generate flow.
//
// LLM-consuming: onClick is the ONLY entry that fires
// /api/interview/[id]/study-plan. See memory feedback_no_auto_llm_calls.
//
// On success the page refreshes (router.refresh()) so the server
// component re-fetches the session with the persisted studyPlan and
// renders the StudyPlanCard.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MdAutoStories } from 'react-icons/md';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/use-t';
import { useSettings } from '@/features/analyze/settings-store';

interface GenerateStudyPlanButtonProps {
  sessionId: string;
}

export function GenerateStudyPlanButton({ sessionId }: GenerateStudyPlanButtonProps) {
  const t = useT();
  const router = useRouter();
  const settings = useSettings();

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onGenerate() {
    if (busy) return;
    setBusy(true);
    setErrorMsg(null);

    const body = {
      llm: {
        provider: settings.provider,
        model: settings.model,
        temperature: settings.temperature,
        ...(settings.provider === 'custom' ? { baseUrl: settings.baseUrl } : {}),
      },
    };

    let res: Response;
    try {
      res = await fetch(`/api/interview/${sessionId}/study-plan`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      setBusy(false);
      setErrorMsg(e instanceof Error ? e.message : String(e));
      return;
    }

    if (res.ok) {
      // Re-fetch the server component data so StudyPlanCard renders
      // from the freshly-persisted column.
      router.refresh();
      return;
    }

    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      if (j.error?.message) msg = j.error.message;
    } catch {
      /* keep generic */
    }
    setErrorMsg(msg);
    setBusy(false);
  }

  return (
    <section
      aria-label={t('interview.studyPlan.title')}
      className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center"
    >
      <MdAutoStories className="mx-auto mb-3 text-primary" size={32} aria-hidden="true" />
      <h2 className="font-display text-title-lg font-bold text-on-surface">
        {t('interview.studyPlan.title')}
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-body-sm text-on-surface-variant">
        {t('interview.studyPlan.subtitle')}
      </p>
      <p className="mx-auto mt-2 max-w-md text-label-sm text-on-surface-variant">
        {t('interview.studyPlan.notice')}
      </p>

      {errorMsg && (
        <p
          role="alert"
          className="mx-auto mt-3 max-w-md rounded-lg border border-error/30 bg-error-container/30 px-3 py-2 text-body-sm text-on-error-container"
        >
          {errorMsg}
        </p>
      )}

      <div className="mt-4 flex justify-center">
        <Button onClick={onGenerate} loading={busy} size="md">
          {busy ? t('interview.studyPlan.generating') : t('interview.studyPlan.generate')}
        </Button>
      </div>
    </section>
  );
}

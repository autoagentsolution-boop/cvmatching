// In-progress answer form for /interview/[id].
//
// LLM-consuming: the Submit button is the ONLY entry that fires the grade
// LLM call. See memory: feedback_no_auto_llm_calls.
//
// State shape stays stable across submits — the wrapper article elements in
// QuestionCard never remount; only their data-state + grade prop change.
// See memory: feedback_react_stable_jsx_tree.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MdSend } from 'react-icons/md';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/use-t';
import { useSettings } from '@/features/analyze/settings-store';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { QuestionCard } from './question-card';
import { DualLensCard } from './dual-lens-card';
import type { DualLens, InterviewQuestion } from '@/lib/llm/schemas-interview';

interface AnswerFormProps {
  sessionId: string;
  dualLens: DualLens;
  questions: Array<Pick<InterviewQuestion, 'id' | 'type' | 'question'>>;
}

export function InterviewAnswerForm({ sessionId, dualLens, questions }: AnswerFormProps) {
  const t = useT();
  const router = useRouter();
  const settings = useSettings();
  const language = useAnalysis((s) => s.language);

  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const q of questions) init[q.id] = '';
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const allAnswered = questions.every((q) => (answers[q.id] ?? '').trim().length > 0);

  function setAnswer(id: string, next: string) {
    setAnswers((s) => ({ ...s, [id]: next }));
  }

  async function onSubmit() {
    if (!allAnswered || busy) return;
    setBusy(true);
    setErrorMsg(null);

    const body = {
      llm: {
        provider: settings.provider,
        model: settings.model,
        temperature: settings.temperature,
        ...(settings.provider === 'custom' ? { baseUrl: settings.baseUrl } : {}),
      },
      sessionId,
      answers: questions.map((q) => ({ id: q.id, answer: answers[q.id] ?? '' })),
      locale: language,
    };

    let res: Response;
    try {
      res = await fetch('/api/interview/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      setBusy(false);
      setErrorMsg((e instanceof Error ? e.message : String(e)));
      return;
    }

    if (res.ok) {
      router.push(`/interview/${sessionId}/results`);
      return;
    }

    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      if (j.error?.message) msg = j.error.message;
    } catch { /* keep generic */ }
    setErrorMsg(msg);
    setBusy(false);
  }

  return (
    <div className="space-y-10">
      <DualLensCard dualLens={dualLens} />

      <section aria-label="Interview questions" className="space-y-4">
        <header className="border-b border-outline-variant pb-3">
          <h2 className="text-title-lg font-bold text-on-surface">10 câu hỏi</h2>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            4 behavioral · 4 technical · 2 scenario. Trả lời từng câu rồi bấm Nộp ở cuối trang.
          </p>
        </header>
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            index={i}
            id={q.id}
            type={q.type}
            question={q.question}
            answer={answers[q.id] ?? ''}
            readOnly={busy}
            onAnswerChange={(next) => setAnswer(q.id, next)}
          />
        ))}
      </section>

      {errorMsg && (
        <p role="alert" className="rounded-lg border border-error/30 bg-error-container/30 px-4 py-3 text-body-sm text-on-error-container">
          {errorMsg}
        </p>
      )}

      <div className="sticky bottom-4 z-10 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-soft">
        {/* Submit — onClick is the ONLY LLM trigger. */}
        <Button onClick={onSubmit} disabled={!allAnswered} loading={busy} fullWidth size="lg" trailingIcon={<MdSend size={18} />}>
          {busy ? t('interview.submit.loading') : allAnswered ? t('interview.submit.button') : t('interview.submit.disabled')}
        </Button>
      </div>
    </div>
  );
}

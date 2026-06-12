// Interview start form — client component.
//
// LLM-consuming: the Start button is the ONLY entry that fires the LLM
// call. See memory: feedback_no_auto_llm_calls — no useEffect / route /
// mount handlers ever fire /api/interview/start.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MdArrowForward, MdInfoOutline } from 'react-icons/md';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/use-t';
import { useSettings } from '@/features/analyze/settings-store';
import { useAnalysis } from '@/features/analyze/analysis-store';
import { ByokMissingCta } from './byok-missing-cta';

interface AnchorCvOption {
  id: string;
  name: string;
}

interface StartFormProps {
  /** Pre-filled when arriving from Job Fit (?jobId=…). */
  initialJobId: string | null;
  initialJobTitle: string | null;
  initialCompany: string | null;
  cvs: AnchorCvOption[];
  defaultCvId: string | null;
}

type Mode = 'job_fit' | 'standalone';

export function InterviewStartForm({
  initialJobId,
  initialJobTitle,
  initialCompany,
  cvs,
  defaultCvId,
}: StartFormProps) {
  const t = useT();
  const router = useRouter();
  const settings = useSettings();
  const language = useAnalysis((s) => s.language);

  const [mode, setMode] = useState<Mode>(initialJobId ? 'job_fit' : 'standalone');
  const [roleTitle, setRoleTitle] = useState<string>('');
  const [cvId, setCvId] = useState<string>(defaultCvId ?? cvs[0]?.id ?? '');
  const [anchorRoleTitle, setAnchorRoleTitle] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [byokMissing, setByokMissing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const formValid =
    !!cvId &&
    anchorRoleTitle.trim().length >= 2 &&
    (mode === 'job_fit' ? !!initialJobId : roleTitle.trim().length >= 2);

  async function onStart() {
    if (!formValid || busy) return;
    setBusy(true);
    setErrorMsg(null);
    setByokMissing(false);

    const body = {
      llm: {
        provider: settings.provider,
        model: settings.model,
        temperature: settings.temperature,
        ...(settings.provider === 'custom' ? { baseUrl: settings.baseUrl } : {}),
      },
      mode,
      ...(mode === 'job_fit' ? { jobId: initialJobId } : { roleTitle: roleTitle.trim() }),
      cvId,
      anchorRoleTitle: anchorRoleTitle.trim(),
      locale: language,
    };

    let res: Response;
    try {
      res = await fetch('/api/interview/start', {
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
      const data = (await res.json()) as { sessionId: string };
      router.push(`/interview/${data.sessionId}`);
      return;
    }

    if (res.status === 402) {
      setByokMissing(true);
      setBusy(false);
      return;
    }

    // 409 resume — body carries existing sessionId.
    if (res.status === 409) {
      const data = (await res.json().catch(() => ({}))) as { sessionId?: string };
      if (data.sessionId) {
        router.push(`/interview/${data.sessionId}`);
        return;
      }
    }

    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      if (j.error?.message) msg = j.error.message;
    } catch { /* keep generic */ }
    setErrorMsg(msg);
    setBusy(false);
  }

  if (byokMissing) return <ByokMissingCta />;

  return (
    <div className="space-y-6 rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-soft">
      {/* Mode toggle */}
      <div className="flex gap-2 rounded-lg bg-surface-container-low p-1">
        <ModeTab active={mode === 'job_fit'} disabled={!initialJobId} onClick={() => setMode('job_fit')}>
          {t('interview.mode.jobFit')}
        </ModeTab>
        <ModeTab active={mode === 'standalone'} onClick={() => setMode('standalone')}>
          {t('interview.mode.standalone')}
        </ModeTab>
      </div>

      {/* Target role */}
      {mode === 'job_fit' && initialJobId ? (
        <Field label={t('interview.field.targetRole')} help={null}>
          <div className="rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-md text-on-surface">
            {initialJobTitle ?? '—'} {initialCompany ? `· ${initialCompany}` : ''}
          </div>
        </Field>
      ) : (
        <Field label={t('interview.field.targetRole')} help={t('interview.field.targetRole.help')}>
          <input
            type="text"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            className="h-12 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-body-md text-on-surface focus:border-on-tertiary-container focus:outline-none focus:ring-4 focus:ring-on-tertiary-container/10"
            placeholder="e.g. Senior Backend Engineer"
            maxLength={160}
            aria-label={t('interview.field.targetRole')}
          />
        </Field>
      )}

      {/* Anchor CV */}
      <Field label={t('interview.field.anchorCv')} help={t('interview.field.anchorCv.help')}>
        {cvs.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant">
            Bạn chưa có CV trong thư viện. Hãy upload ở trang <a className="text-primary underline" href="/cvs">My CVs</a> trước.
          </p>
        ) : (
          <select
            value={cvId}
            onChange={(e) => setCvId(e.target.value)}
            className="h-12 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-body-md text-on-surface focus:border-on-tertiary-container focus:outline-none focus:ring-4 focus:ring-on-tertiary-container/10"
          >
            {cvs.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </Field>

      {/* Anchor role title */}
      <Field label={t('interview.field.anchorRoleTitle')} help={t('interview.field.anchorRoleTitle.help')}>
        <input
          type="text"
          value={anchorRoleTitle}
          onChange={(e) => setAnchorRoleTitle(e.target.value)}
          className="h-12 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-body-md text-on-surface focus:border-on-tertiary-container focus:outline-none focus:ring-4 focus:ring-on-tertiary-container/10"
          placeholder="e.g. Backend Engineer @ Foo Corp"
          maxLength={160}
          aria-label={t('interview.field.anchorRoleTitle')}
        />
      </Field>

      <p className="flex items-start gap-2 rounded-lg bg-tertiary-container/40 px-4 py-3 text-body-sm text-on-tertiary-container">
        <MdInfoOutline className="mt-0.5 flex-shrink-0" size={18} aria-hidden="true" />
        <span>
          {t('interview.field.provider')}: <strong>{settings.provider}</strong> · {settings.model}.
          {' '}{t('interview.start.cost.notice')}
        </span>
      </p>

      {errorMsg && (
        <p role="alert" className="rounded-lg border border-error/30 bg-error-container/30 px-4 py-3 text-body-sm text-on-error-container">
          {errorMsg}
        </p>
      )}

      {/* Start — onClick is the ONLY LLM trigger. */}
      <Button onClick={onStart} disabled={!formValid} loading={busy} fullWidth size="lg" trailingIcon={<MdArrowForward size={18} />}>
        {busy ? t('interview.start.loading') : formValid ? t('interview.start.button') : t('interview.start.disabled')}
      </Button>
    </div>
  );
}

function ModeTab({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex-1 rounded-md px-4 py-2 text-label-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'bg-surface text-primary shadow-soft'
          : 'text-on-surface-variant hover:bg-surface-container'
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-label-md font-medium text-on-surface">{label}</label>
      {children}
      {help && <p className="text-label-sm text-on-surface-variant">{help}</p>}
    </div>
  );
}

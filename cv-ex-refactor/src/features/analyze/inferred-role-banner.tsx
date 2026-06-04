'use client';

import { useState } from 'react';
import { MdEdit, MdCheck, MdClose } from 'react-icons/md';
import { Button, Input } from '@/components/ui';

interface Props {
  /** Role the result was scored against. */
  role: string;
  /** Confidence reported by role-infer; omitted if user already confirmed. */
  confidence?: number;
  /** Fires when user submits an override role; parent re-runs analyze. */
  onOverride: (newRole: string) => void;
  /** Disabled state while re-analyze fires. */
  busy?: boolean;
}

const MIN_LEN = 3;
const MAX_LEN = 120;

/**
 * Renders above the result body: "Đánh giá CV cho vai trò: <role>" with an
 * inline "Đổi vai trò" affordance that expands to an input + confirm step.
 *
 * Two-step flow before firing analyze:
 *   1. Click "Đổi vai trò" → input expands
 *   2. Type new role + Enter / click ✓ → confirm row appears
 *   3. Click "Phân tích lại" → fires onOverride (burns 1 quota)
 *      OR click ✗ / Esc → cancels back to original
 *
 * Two-step exists so users don't accidentally burn a 5/day slot when they
 * meant to just preview what the field looks like.
 */
export function InferredRoleBanner({ role, confidence, onOverride, busy = false }: Props) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [draft, setDraft] = useState(role);

  function startEdit() {
    setDraft(role);
    setEditing(true);
    setPending(null);
  }

  function stageOverride() {
    const trimmed = draft.trim();
    if (trimmed.length < MIN_LEN || trimmed === role) {
      setEditing(false);
      setDraft(role);
      return;
    }
    setPending(trimmed);
    setEditing(false);
  }

  function confirmOverride() {
    if (pending) {
      onOverride(pending);
      setPending(null);
    }
  }

  function cancelAll() {
    setDraft(role);
    setEditing(false);
    setPending(null);
  }

  // Idle: showing current role + edit affordance
  const showIdle = !editing && !pending;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-label-md text-on-surface-variant">Đánh giá CV cho vai trò:</span>

        {showIdle && (
          <>
            <strong className="text-body-lg font-bold text-on-tertiary-container">{role}</strong>
            {typeof confidence === 'number' && (
              <span className="rounded-full bg-tertiary-container/60 px-2 py-0.5 text-label-sm font-bold text-on-tertiary-container">
                {Math.round(confidence * 100)}%
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={startEdit}
              disabled={busy}
              leadingIcon={<MdEdit size={16} aria-hidden="true" />}
            >
              Đổi vai trò
            </Button>
          </>
        )}

        {editing && (
          <div className="flex flex-1 min-w-[200px] items-center gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
              placeholder="Vai trò mới…"
              disabled={busy}
              maxLength={MAX_LEN}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') stageOverride();
                else if (e.key === 'Escape') cancelAll();
              }}
              className="flex-1"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={stageOverride}
              disabled={busy || draft.trim().length < MIN_LEN || draft.trim() === role}
              aria-label="Xem trước vai trò mới"
            >
              <MdCheck size={16} aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelAll}
              disabled={busy}
              aria-label="Huỷ"
            >
              <MdClose size={16} aria-hidden="true" />
            </Button>
          </div>
        )}

        {pending && (
          <>
            <span className="text-body-md text-on-surface line-through opacity-60">{role}</span>
            <span className="text-body-md text-on-surface-variant">→</span>
            <strong className="text-body-lg font-bold text-on-tertiary-container">{pending}</strong>
          </>
        )}
      </div>

      {pending && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant pt-2">
          <p className="text-label-sm text-on-surface-variant">
            Phân tích lại sẽ tiêu 1 lượt quota (5/ngày). Tiếp tục?
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelAll}
              disabled={busy}
            >
              Huỷ
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={confirmOverride}
              disabled={busy}
              loading={busy}
            >
              Phân tích lại
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

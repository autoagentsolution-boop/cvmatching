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
 * inline "Đổi vai trò" affordance that expands to an input + apply button.
 * No popover — a simple inline collapse keeps focus management trivial and
 * avoids another Radix dependency.
 */
export function InferredRoleBanner({ role, confidence, onOverride, busy = false }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(role);

  function submit() {
    const trimmed = draft.trim();
    if (trimmed.length < MIN_LEN || trimmed === role) {
      setEditing(false);
      setDraft(role);
      return;
    }
    onOverride(trimmed);
    setEditing(false);
  }

  function cancel() {
    setDraft(role);
    setEditing(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3">
      <span className="text-label-md text-on-surface-variant">Đánh giá CV cho vai trò:</span>

      {!editing && (
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
            onClick={() => setEditing(true)}
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
              if (e.key === 'Enter') submit();
              else if (e.key === 'Escape') cancel();
            }}
            className="flex-1"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            disabled={busy || draft.trim().length < MIN_LEN || draft.trim() === role}
            loading={busy}
            aria-label="Áp dụng vai trò mới"
          >
            <MdCheck size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={cancel}
            disabled={busy}
            aria-label="Huỷ"
          >
            <MdClose size={16} aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}

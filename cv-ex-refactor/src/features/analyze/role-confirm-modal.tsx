'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Modal, ModalFooter } from '@/components/ui';
import type { RoleCandidate } from './analysis-store';

interface Props {
  open: boolean;
  candidates: RoleCandidate[];
  onConfirm: (role: string) => void;
  onClose: () => void;
  /** Disabled state while re-analyze fires after confirm. */
  busy?: boolean;
}

const MIN_LEN = 3;
const MAX_LEN = 120;

/**
 * v0.4 role-confirm modal. Renders when /api/analyze returns
 * `needsRoleConfirm: true`. User picks a candidate radio OR types a custom
 * role; click "Tiếp tục" → parent fires the second /api/analyze call with
 * the chosen role, bypassing role-infer.
 *
 * Custom text takes priority over radio selection so a user can override
 * a chosen candidate by typing without first having to deselect it.
 */
export function RoleConfirmModal({ open, candidates, onConfirm, onClose, busy = false }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const [custom, setCustom] = useState('');

  useEffect(() => {
    if (open) {
      setPicked(candidates[0]?.canonical ?? null);
      setCustom('');
    }
  }, [open, candidates]);

  const trimmedCustom = custom.trim();
  const finalRole = trimmedCustom.length >= MIN_LEN ? trimmedCustom : picked;
  const canSubmit = !!finalRole && finalRole.length >= MIN_LEN && !busy;

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Vai trò mục tiêu"
      size="md"
      dismissOnBackdrop={!busy}
    >
      <p className="mb-4 text-body-md text-on-surface-variant">
        Chúng tôi chưa chắc chắn về vai trò bạn đang nhắm tới. Chọn một gợi ý hoặc
        nhập vai trò khác để tiếp tục đánh giá.
      </p>

      <fieldset className="flex flex-col gap-2" disabled={busy}>
        <legend className="sr-only">Vai trò gợi ý</legend>
        {candidates.length === 0 && (
          <p className="text-label-sm text-on-surface-variant">
            Không có gợi ý — vui lòng nhập vai trò bên dưới.
          </p>
        )}
        {candidates.map((c) => {
          const id = `role-candidate-${c.canonical.replace(/\s+/g, '-').toLowerCase()}`;
          return (
            <label
              key={c.canonical}
              htmlFor={id}
              className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-colors ${
                picked === c.canonical && trimmedCustom.length === 0
                  ? 'border-on-tertiary-container/60 bg-tertiary-container/50'
                  : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  id={id}
                  type="radio"
                  name="role-candidate"
                  value={c.canonical}
                  checked={picked === c.canonical && trimmedCustom.length === 0}
                  onChange={() => {
                    setPicked(c.canonical);
                    setCustom('');
                  }}
                  className="h-4 w-4 accent-on-tertiary-container"
                />
                <span className="text-body-md text-on-surface">{c.canonical}</span>
              </span>
              <span className="text-label-sm font-bold text-on-surface-variant">
                {Math.round(c.confidence * 100)}%
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className="mt-4 flex flex-col gap-2">
        <label htmlFor="role-custom" className="text-label-sm font-bold text-primary uppercase tracking-wide">
          Hoặc nhập vai trò khác
        </label>
        <Input
          id="role-custom"
          value={custom}
          onChange={(e) => setCustom(e.target.value.slice(0, MAX_LEN))}
          placeholder="ví dụ: Senior Data Engineer"
          disabled={busy}
          maxLength={MAX_LEN}
        />
        {trimmedCustom.length > 0 && trimmedCustom.length < MIN_LEN && (
          <p className="text-label-sm text-error" role="alert">
            Vai trò phải có ít nhất {MIN_LEN} ký tự.
          </p>
        )}
      </div>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Huỷ
        </Button>
        <Button
          variant="primary"
          onClick={() => finalRole && onConfirm(finalRole)}
          disabled={!canSubmit}
          loading={busy}
        >
          Tiếp tục
        </Button>
      </ModalFooter>
    </Modal>
  );
}

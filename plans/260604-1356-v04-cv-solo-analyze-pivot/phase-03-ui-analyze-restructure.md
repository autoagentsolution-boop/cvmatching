# Phase 3 — UI /analyze Restructure (Strip JD + Role-Confirm Modal)

**Effort:** 2-3h
**Owner:** lead
**Status:** pending
**Blocked by:** phase 2
**Blocks:** phase 6

## Goal

Strip JD textarea + must-have inline block from `/analyze` page. Add role-confirmation modal triggered by `needsRoleConfirm` API response. Display inferred role at top of result with override link. Keep all other result UI (sliders, recommendations, gaps, strengths, keyword coverage, red flags, suggested summary) — just rescope semantically per Phase 1 schema.

## Files to Create

- `src/features/analyze/role-confirm-modal.tsx` — modal showing candidates + free-text input, ≤ 120 lines
- `src/features/analyze/inferred-role-banner.tsx` — top-of-result component, displays role + "Override" link, ≤ 60 lines
- `src/features/analyze/role-override-popover.tsx` — popover with text input + apply-by-re-analyzing, ≤ 80 lines
- `tests/features/analyze/role-confirm-modal.test.tsx` — RTL covering state matrix

## Files to Modify

- `src/features/analyze/page.tsx` (or `src/app/(app)/analyze/page.tsx` depending on layout) — strip JD textarea
- `src/features/analyze/analyze-form.tsx` — remove JD field, simplify to CV-only paste
- `src/features/analyze/analysis-result.tsx` — render `inferredRole` banner; remove must-have block reference; pass through to existing dim sliders + sections
- `src/features/analyze/api-client.ts` — handle `needsRoleConfirm` response, 2-call protocol
- `src/features/analyze/analysis-store.ts` — schema v3 shape; remove `jdText` state; add `role`, `needsRoleConfirm`, `candidates` states (Phase 6 bumps version)

## UX Flow

```
1. /analyze loads → empty state with single CV textarea + "Phân tích" button

2. User pastes CV → clicks Analyze
   ↓
   POST /api/analyze { cvText }
   ↓
3a. Response: needsRoleConfirm: true
   ↓
   Modal opens: "Chúng tôi chưa chắc về vai trò mục tiêu của bạn"
   - 3 candidate radio buttons (canonical names + confidence %)
   - Free-text input: "Hoặc nhập vai trò khác..."
   - [Tiếp tục] disabled until selection
   ↓
   User picks/types → click Tiếp tục
   ↓
   POST /api/analyze { cvText, role: chosen }
   ↓
   Full result returned
   ↓
3b. Response: full v3 result (high conf, no modal)
   ↓
4. Result page:
   - Inferred role banner at top: "Đánh giá CV cho vai trò: Senior Backend Engineer [Đổi vai trò]"
   - Click [Đổi vai trò] → popover with text input → submit → re-analyze with new role
   - Below banner: 9-dim sliders + overall score (unchanged UX)
   - Strong points / weak points / presentation issues / experience gaps sections
   - Recommendations
   - Keyword coverage chips
   - Red flags
   - Suggested summary line
```

## Component Sketches

```tsx
// role-confirm-modal.tsx
export function RoleConfirmModal({ open, candidates, onConfirm, onClose }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const [custom, setCustom] = useState('');

  const final = custom.trim() || picked;
  const canSubmit = (final?.length ?? 0) >= 3;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Vai trò mục tiêu</DialogTitle>
      <DialogBody>
        <p>Chúng tôi chưa chắc về vai trò bạn đang nhắm tới. Chọn một trong các gợi ý hoặc nhập vai trò khác:</p>
        <RadioGroup value={picked} onChange={setPicked}>
          {candidates.map((c) => (
            <Radio key={c.canonical} value={c.canonical}>
              {c.canonical}
              <span className={styles.confidence}>{Math.round(c.confidence * 100)}%</span>
            </Radio>
          ))}
        </RadioGroup>
        <hr />
        <Input
          placeholder="Hoặc nhập vai trò khác..."
          value={custom}
          onChange={(e) => { setCustom(e.target.value); setPicked(null); }}
        />
      </DialogBody>
      <DialogActions>
        <Button onClick={onClose} variant="ghost">Huỷ</Button>
        <Button onClick={() => onConfirm(final!)} disabled={!canSubmit}>Tiếp tục</Button>
      </DialogActions>
    </Dialog>
  );
}
```

```tsx
// inferred-role-banner.tsx
export function InferredRoleBanner({ role, onChange }: { role: string; onChange: (r: string) => void }) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  return (
    <div className={styles.banner}>
      <span>Đánh giá CV cho vai trò:</span>
      <strong className={styles.role}>{role}</strong>
      <button onClick={() => setPopoverOpen(true)} className={styles.changeLink}>Đổi vai trò</button>
      <RoleOverridePopover
        open={popoverOpen}
        currentRole={role}
        onSubmit={(newRole) => { onChange(newRole); setPopoverOpen(false); }}
        onClose={() => setPopoverOpen(false)}
      />
    </div>
  );
}
```

## API Client Update

```ts
// api-client.ts
export async function analyzeCv(cvText: string, role?: string): Promise<AnalyzeResult | NeedsRoleConfirm> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cvText, role }),
  });
  if (!res.ok) throw new AnalyzeError(res.status, await res.text());
  return res.json();
}

export function isNeedsRoleConfirm(x: AnalyzeResult | NeedsRoleConfirm): x is NeedsRoleConfirm {
  return 'needsRoleConfirm' in x && x.needsRoleConfirm === true;
}
```

## Implementation Steps

1. Build `role-confirm-modal.tsx` + `inferred-role-banner.tsx` + `role-override-popover.tsx` using existing design tokens + shared components per [[feedback_ui_ux_design_system]].
2. Update `analyze-form.tsx` to remove JD textarea + remove must-have inline; single CV textarea + button.
3. Wire `api-client.ts` 2-call protocol. Discriminator: `needsRoleConfirm` field.
4. Update `analysis-result.tsx`:
   - Read `result.inferredRole.canonical` → render `<InferredRoleBanner>` at top
   - Strip must-have block reference (moved to Job Fit detail in Phase 4)
   - Sliders + sections unchanged (v3 schema is superset of v2 fields they use)
5. Wire `analysis-store.ts` for new state: `pendingCvText` (for re-analyze after override), `currentRole`, `candidates`.
6. RTL tests:
   - Render `/analyze` page → only CV textarea visible (no JD field)
   - Paste CV + analyze → API mocked to return `needsRoleConfirm` → modal opens
   - Pick candidate → confirm fires API → result renders
   - Free-text custom role → confirm fires API → result renders
   - Result with inferred role → banner shows → click override → popover → submit → re-analyzes
   - Verify must-have block NOT rendered on result
7. Visual check: dev server, paste sample CVs, verify both modal + override + full result render cleanly mobile + desktop. Screenshots to `Screenshot/v4-analyze-{state}.png`.

## Acceptance Criteria

- [ ] JD textarea removed from `/analyze` page
- [ ] Must-have inline block removed from result
- [ ] Role-confirm modal renders on `needsRoleConfirm: true`
- [ ] Inferred-role banner with override link on full result
- [ ] 2-call protocol works: confirm fires 2nd POST with `role` param
- [ ] All existing result UI (sliders, sections, keywords, red flags) still renders correctly with v3 data
- [ ] No layout regression mobile + desktop
- [ ] Uses tokens + shared components, no leaked AI/prompt text
- [ ] RTL tests cover 5+ render states
- [ ] `pnpm tsc --noEmit` clean

## Risks

- **Modal blocks UX flow**: forced confirm on every low-conf CV may feel annoying. Mitigation: confidence threshold 0.75 starts conservative; loosen to 0.65 if user data shows modal fires > 30% of analyzes.
- **Override loop**: user picks wrong role, sees bad scores, picks again → 3+ analyses burned for 1 task. Mitigation: override popover counts toward same quota call (server has no idea it's a re-analyze); accept this cost initially; track override rate.
- **Layout shift**: removing JD textarea changes form-to-button vertical position. Mitigation: design layout v4-from-scratch rather than incremental; reserve hero space for CV-only with marketing copy.

## Security

- Role input sanitization: max length 80 chars, alphanumeric + space + common punctuation only
- Modal trap-focus + escape-to-close per a11y
- Override popover prevents injection by treating input as plain string passed to API (server validates)

## Next Phase

→ phase-06-cache-version-bump.md (after Phases 4 + 5 done; cache version covers all v3 changes)

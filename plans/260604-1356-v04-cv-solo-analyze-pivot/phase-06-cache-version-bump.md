# Phase 6 — Cache Version Bump + Re-Analyze Banner

**Effort:** 1h
**Owner:** lead
**Status:** pending
**Blocked by:** phases 2, 3, 4, 5
**Blocks:** phase 7

## Goal

Bump sessionStorage `analyze:v2` → `analyze:v3` for the new shape (added `inferredRole`, removed must-have, renamed gap fields). On app load, detect v2 cache → show banner "Ứng dụng đã cập nhật — Analyze lại để xem điểm theo cấu trúc mới?" Banner is user-driven only — do NOT auto-fire re-analyze (would burn quota silently per decision #4).

## Files to Create

- `src/components/banners/re-analyze-banner.tsx` — banner UI, ≤ 80 lines
- `src/features/analyze/cache-migration.ts` — detection + migration helpers, ≤ 60 lines
- `tests/features/analyze/cache-migration.test.ts` — vitest covering v2/v3 detection + dismiss + re-analyze paths

## Files to Modify

- `src/features/analyze/analysis-store.ts` — bump schema version constant to `'v3'`; persist key `analyze:v3`; add `legacyV2Detected: boolean` state
- `src/app/(app)/layout.tsx` (or app shell) — mount `<ReAnalyzeBanner />` globally
- `src/features/analyze/page.tsx` — on first mount, run migration check; set banner visibility

## Migration Logic

```ts
// cache-migration.ts
export const CURRENT_SCHEMA = 'v3';
const SCHEMA_KEYS = ['analyze:v1', 'analyze:v2'];

export function detectLegacyCache(): { found: boolean; oldKey: string | null; cvText: string | null } {
  if (typeof window === 'undefined') return { found: false, oldKey: null, cvText: null };

  for (const key of SCHEMA_KEYS) {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return { found: true, oldKey: key, cvText: parsed.cvText ?? null };
      } catch {
        // corrupt — treat as legacy
        return { found: true, oldKey: key, cvText: null };
      }
    }
  }
  return { found: false, oldKey: null, cvText: null };
}

export function dismissLegacyCache(): void {
  for (const key of SCHEMA_KEYS) sessionStorage.removeItem(key);
}
```

## Banner UI

```tsx
// re-analyze-banner.tsx
'use client';
export function ReAnalyzeBanner() {
  const router = useRouter();
  const [legacy, setLegacy] = useState<ReturnType<typeof detectLegacyCache> | null>(null);
  const { setCvText } = useAnalyzeStore();

  useEffect(() => {
    const result = detectLegacyCache();
    if (result.found) setLegacy(result);
  }, []);

  if (!legacy?.found) return null;

  const handleReAnalyze = () => {
    if (legacy.cvText) {
      setCvText(legacy.cvText);
      dismissLegacyCache();
      router.push('/analyze?autorun=1');
    } else {
      dismissLegacyCache();
      router.push('/analyze');
    }
    setLegacy(null);
  };

  const handleDismiss = () => {
    dismissLegacyCache();
    setLegacy(null);
  };

  return (
    <div className={styles.banner} role="status">
      <span>Ứng dụng đã cập nhật. Analyze lại để xem điểm theo cấu trúc mới?</span>
      <Button onClick={handleReAnalyze} variant="primary" size="sm">Analyze lại</Button>
      <button onClick={handleDismiss} className={styles.dismissBtn} aria-label="Đóng">×</button>
    </div>
  );
}
```

## Quota Protection

- Banner action triggers re-analyze ONLY when user clicks `[Analyze lại]`
- The re-analyze hits the same `/api/analyze` endpoint and consumes the 5/day quota — same as any manual analyze
- Decision #4 explicit: do NOT auto-fire; user-driven only
- If `cvText` lost during migration (e.g. corruption), redirect to empty `/analyze` page — user manually pastes

## Implementation Steps

1. Build `cache-migration.ts` with `detectLegacyCache` + `dismissLegacyCache`. Test with mocked sessionStorage.
2. Build `re-analyze-banner.tsx` per sketch. Mount globally in app layout so it shows on any page transition post-update.
3. Update `analysis-store.ts`:
   - `STORAGE_KEY = 'analyze:v3'`
   - Add migration check on hydrate; if v2 detected and v3 empty, store cvText into state but mark `pendingMigration: true`
4. Update `/analyze` page to handle `?autorun=1` param → if cvText in store, fire analyze on mount.
5. RTL tests:
   - sessionStorage with v2 shape → banner renders
   - Click "Analyze lại" → redirects to /analyze?autorun=1 + clears v2
   - Click "×" → banner hides + clears v2
   - sessionStorage with v3 only → banner does not render
   - sessionStorage empty → banner does not render
6. Manual test in preview: deploy v3 → existing browser with v2 cache visits → banner shows.

## Acceptance Criteria

- [ ] `analyze:v3` is the persisted key
- [ ] Detection finds v1 + v2 legacy keys
- [ ] Banner renders globally only when legacy detected
- [ ] "Analyze lại" CTA clears legacy + redirects to autorun
- [ ] Dismiss button clears legacy without re-analyzing
- [ ] No auto-burn of quota (user must click to consume)
- [ ] Banner copy in Vietnamese, no leaked AI text
- [ ] Tests cover all 4 states (legacy / clean / mid-migration / dismiss)
- [ ] `pnpm tsc --noEmit` clean

## Risks

- **Banner shows on every page** until dismissed → annoying if user ignores. Mitigation: persist `bannerDismissed: true` in localStorage (separate from sessionStorage) so dismissal sticks across browser sessions. (Don't persist in sessionStorage — that'd clear with legacy data.)
- **Lost cvText during migration** if v2 was corrupt → empty analyze page after redirect. Mitigation: copy + button label distinguishes ("paste your CV again" if cvText missing).
- **Multi-tab edge**: 2 tabs open, both with v2 → both show banner → both clear separately. No harm but slight redundancy.

## Security

- `cvText` from legacy v2 cache treated as user-supplied input → re-sent to /api/analyze through normal validation
- localStorage dismissal flag is bool only, no sensitive data
- No XSS surface in banner (all text static)

## Next Phase

→ phase-07-memory-docs-sync.md

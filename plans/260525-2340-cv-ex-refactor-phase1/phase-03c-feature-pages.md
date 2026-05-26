# Phase 03c — Feature Pages

> Parent: [phase-03-ui-port.md](phase-03-ui-port.md)
> Depends on: [phase-03a-design-tokens-shared-ui.md](phase-03a-design-tokens-shared-ui.md), [phase-03b-layout-templates.md](phase-03b-layout-templates.md)
> Hard UI/UX contract applies — read parent first.

## Overview

Build the **4 Stitch screens** + **3 stub tabs** as feature pages. Every page composes from `src/components/ui/` (shared) and `src/components/layouts/` (templates). Feature folders contain ONLY business logic — state stores, API clients, validation, data mapping, workflow composition. **No visual primitives in this sub-phase.**

**Priority:** P0
**Status:** pending
**Estimated effort:** 7–10 hours
**File ownership:** Owners A / B / C each take 1–2 screens (parallel after 03b done)

## Feature Folder Layout

```
src/features/
├── auth/
│   ├── sign-in-form.tsx              # 'use client' — composes AuthLayout children
│   └── auth-store.ts                 # session helpers (Phase 02 already wired)
├── analyze/
│   ├── analyze-page.tsx              # Top-level — composes DashboardLayout > FormPageLayout
│   ├── cv-input-block.tsx            # 'use client' — wires DropZone + file-parsers + analysis-store
│   ├── jd-input-block.tsx            # 'use client' — textarea + URL input + char counter
│   ├── analysis-parameters-block.tsx # 'use client' — 3 Sliders + Badge preset
│   ├── settings-panel-block.tsx      # 'use client' — provider/model/key controls + Modal confirm
│   ├── analyze-cta.tsx               # 'use client' — Button + loading state + error toast
│   ├── settings-store.ts             # Zustand persist (BYOK key opt-in)
│   ├── analysis-store.ts             # Zustand transient (jd, cv, result)
│   ├── api-client.ts                 # callAnalyze, callGenerateCv stubs
│   ├── file-parsers.ts               # parseFile(file) — TXT client, DOCX/PDF → /api/parse
│   └── types.ts                      # AnalysisResult, RoleFamily, Strictness, Language, Provider
├── results/
│   ├── results-page.tsx              # Composes DashboardLayout > DetailPanelLayout
│   ├── match-score-block.tsx         # CircularProgress + headline + Badge chips
│   ├── optimization-paths-block.tsx  # Card list of paths
│   ├── keyword-coverage-block.tsx    # Badge chips for matched/missing keywords
│   ├── recommendations-block.tsx     # Ordered list of recommendations
│   └── interview-questions-stub.tsx  # EmptyState "Predictive Interview Questions — Phase 2"
└── refined-cv/
    ├── refined-cv-page.tsx           # Composes DashboardLayout > DetailPanelLayout
    ├── refined-cv-view.tsx           # MarkdownView wrap
    ├── key-enhancements-block.tsx    # Card list
    ├── refine-tools-block.tsx        # Tone / length / extra instructions + regenerate Button
    └── refined-cv-actions.tsx        # Download .md / .html buttons
```

## App Route Wiring

Thin wrappers in `src/app/` — no logic, just import and render.

```
src/app/
├── (auth)/
│   └── sign-in/page.tsx              # imports AuthLayout + SignInForm
├── (app)/
│   ├── layout.tsx                    # imports DashboardLayout; reads session
│   ├── page.tsx                      # imports AnalyzePage
│   ├── refined-cv/page.tsx           # imports RefinedCvPage
│   ├── history/page.tsx              # stub
│   ├── optimizations/page.tsx        # stub
│   └── career-path/page.tsx          # stub
```

**Rule:** every `app/*/page.tsx` is < 30 LOC. Real composition lives in the feature page.

## Screen-by-Screen Detail

### 1. Login (`/sign-in`)

**Stitch reference:** `trang_ng_nh_p/code.html`
**Layout:** `AuthLayout` (no nesting)
**Feature components:** `SignInForm`

**Composition:**
```tsx
// src/features/auth/sign-in-form.tsx
'use client';
import { Card, Button, Input, FormField, Badge } from '@/components/ui';

export function SignInForm() {
  return (
    <Card padding="lg">
      <header className="mb-10 flex flex-col items-center gap-2">
        <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center mb-4">
          <Icon name="auto_fix_high" className="text-on-primary" size={32} />
        </div>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:text-headline-lg text-primary text-center">
          Welcome to ResumeRefine
        </h1>
        <p className="font-body-md text-body-md text-on-primary-container text-center">
          Your AI-powered career assistant
        </p>
      </header>

      <Button variant="secondary" size="lg" fullWidth leadingIcon={<GoogleLogo />} onClick={signInWithGoogle}>
        Continue with Google
      </Button>

      <Divider label="OR" className="my-6" />

      <FormField label="Email Address" htmlFor="email">
        <Input id="email" type="email" placeholder="name@company.com" autoComplete="email" value={email} onChange={...} />
      </FormField>
      <Button variant="primary" size="lg" fullWidth className="mt-4" onClick={requestMagicLink}>
        Get Started
      </Button>

      <footer className="mt-10 pt-8 border-t border-outline-variant/30 flex flex-col items-center gap-4">
        <Link href="/?mode=byok" className="text-on-tertiary-container hover:underline">
          Enter as Guest
        </Link>
        <p className="font-label-sm text-label-sm text-outline text-center">
          By continuing, you agree to <Link href="/tos">Terms</Link> and <Link href="/privacy">Privacy</Link>.
        </p>
      </footer>
    </Card>
  );
}
```

**Shared UI consumed:** `Card`, `Input`, `FormField`, `Button`, `Badge` (for "Bank-level security" trust footer).
**Business logic:** email validation, signInWithGoogle handler (calls Auth.js), magic link handler (Phase 2 — Phase 1 disabled + tooltip).
**Decoration:** background atmospheric shapes belong to `AuthLayout`, not duplicated here.

**Pre-finalization scan:** no inline hex, no rounded literals, no shadow literals — all from tokens via `Card` props.

### 2. Analyze (`/`)

**Stitch reference:** `trang_dashboard_t_i_l_n/code.html`
**Layout:** `DashboardLayout` > `FormPageLayout`
**Feature components:** `AnalyzePage`, `CvInputBlock`, `JdInputBlock`, `AnalysisParametersBlock`, `SettingsPanelBlock`, `AnalyzeCta`

**Composition (`analyze-page.tsx`):**
```tsx
import { PageHeader } from '@/components/ui';
import { CvInputBlock } from './cv-input-block';
import { JdInputBlock } from './jd-input-block';
import { AnalysisParametersBlock } from './analysis-parameters-block';
import { SettingsPanelBlock } from './settings-panel-block';
import { AnalyzeCta } from './analyze-cta';

export function AnalyzePage() {
  return (
    <FormPageLayout
      header={
        <PageHeader
          title={<>Match your profile to your <span className="text-on-tertiary-container">dream role.</span></>}
          subtitle="Upload your CV and the Job Description. Our AI will analyze the alignment, find keyword gaps, and score your readiness."
        />
      }
      sections={
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <CvInputBlock />
          <JdInputBlock />
        </div>
      }
      stickyAction={<AnalyzeCta />}
      meta={<p className="text-sm text-on-surface-variant mt-4">Estimated processing time: 4–6 seconds</p>}
    />
  );
}
```

**Sub-sections layered below CV/JD bento grid:** `<AnalysisParametersBlock />` and `<SettingsPanelBlock />` (collapsible) sit between the grid and the CTA.

**Shared UI consumed:** `PageHeader`, `Card`, `DropZone`, `Input`, `Select`, `Slider`, `Button`, `Badge`, `FormField`, `Modal` (BYOK confirm), `Drawer` (mobile settings).

**Business logic:**
- `cv-input-block.tsx`: `DropZone` → `parseFile()` → push to `analysis-store.cvText`; show parsed file name + size; "Clear" button.
- `jd-input-block.tsx`: textarea + URL `Input` + "Paste URL instead" toggle + char counter; URL submit → calls `/api/scrape` (Phase 05).
- `analysis-parameters-block.tsx`: 3 `Slider` controls (Keyword Match / Experience Depth / Soft Skills), preset `Badge`, 3 checkboxes (Compare with industry benchmarks / ATS readability / AI-suggested verbs).
- `settings-panel-block.tsx`: BYOK vs shared toggle. If shared + not authed → CTA "Sign in to use shared key" (deep-link to `/sign-in`). If BYOK → reveal provider `Select`, model `Input`, API key `Input` (password), Remember key checkbox.
- `analyze-cta.tsx`: `Button` primary lg → `callAnalyze(payload)`. Loading state via `LoadingState` overlay or button spinner. Error via toast or inline `ErrorState`.

**Replaced from Stitch:** Stitch shows "Upgrade to Pro" sidebar block; Phase 1 hides per parent unresolved Q2.

### 3. Results (`/` — inline panel, scrolls below Analyze)

**Stitch reference:** `trang_k_t_qu_xu_t/code.html`
**Layout:** rendered inline within `AnalyzePage` (no separate route Phase 1); when `analysis-store.result !== null` the `<ResultsPage />` block mounts below the Analyze form.

Alternative considered: separate `/results` route. Rejected: Stitch flow shows results inline; KISS.

**Composition (`results-page.tsx`):**
```tsx
export function ResultsPage() {
  const { result, isAnalyzing, error } = useAnalysisStore();
  if (isAnalyzing) return <LoadingState variant="spinner" message="Calculating your match score..." />;
  if (error) return <ErrorState title="Analysis failed" description={error} retry={retry} />;
  if (!result) return null; // pre-analysis nothing shown (or EmptyState if standalone route)

  return (
    <DetailPanelLayout
      header={<PageHeader title="Analysis Results" />}
      main={
        <>
          <MatchScoreBlock result={result} />
          <OptimizationPathsBlock paths={result.recommendations} />
          <InterviewQuestionsStub />
        </>
      }
      aside={
        <>
          <KeywordCoverageBlock coverage={result.coverage} />
          <RecommendationsBlock recommendations={result.recommendations} />
        </>
      }
    />
  );
}
```

**Shared UI consumed:** `PageHeader`, `Card`, `CircularProgress`, `Badge`, `Tabs`, `LoadingState`, `EmptyState`, `ErrorState`, `Button`.

**Business logic:**
- `match-score-block.tsx`: `CircularProgress` with `value={result.overallScore}`; headline ("Strong Performance!" / "Good Match" / "Stretch" / "Low") derived from `result.decision` enum; `Badge` chips for `result.atsKeywords`.
- `optimization-paths-block.tsx`: maps `result.recommendations` → array of `Card variant="interactive"` items with icon + title + description + action.
- `keyword-coverage-block.tsx`: maps `result.coverage` → 3 chip groups (`success` for match, `warning` for partial, `error` for missing).
- `recommendations-block.tsx`: ordered list with priority `Badge`.
- `interview-questions-stub.tsx`: single `EmptyState` titled "Predictive Interview Questions (Phase 2)" — replaces the 3 question cards in Stitch.

**Decision derivations (status mapping):**
- `result.decision === 'strong'` → success Badge "Strong fit"
- `result.decision === 'good'` → info Badge "Good fit"
- `result.decision === 'stretch'` → warning Badge "Stretch"
- `result.decision === 'low'` → error Badge "Low fit"

**Replaced from Stitch:** the "Bottom Illustration Section" (modern office photo + 92% stat) is marketing fluff — removed Phase 1.

### 4. Refined CV (`/refined-cv`)

**Stitch reference:** `trang_cv_t_i_u/code.html`
**Layout:** `DashboardLayout` > `DetailPanelLayout`
**Feature components:** `RefinedCvPage`, `RefinedCvView`, `KeyEnhancementsBlock`, `RefineToolsBlock`, `RefinedCvActions`

**Composition (`refined-cv-page.tsx`):**
```tsx
export function RefinedCvPage() {
  const { matchedCv, result, isGeneratingCv } = useAnalysisStore();
  if (!matchedCv && !isGeneratingCv) return <EmptyState title="No refined CV yet" description="Generate a refined CV from your analysis." action={<Button href="/">Back to Analyze</Button>} />;
  if (isGeneratingCv) return <LoadingState variant="skeleton" lines={12} />;

  return (
    <DetailPanelLayout
      header={
        <PageHeader
          title="Refined CV Preview"
          subtitle={<>Optimized for: <span className="font-bold text-on-tertiary-container">{result?.targetRoleLabel}</span></>}
          action={<RefinedCvActions />}
        />
      }
      main={
        <Card padding="lg">
          <Badge variant="success" size="sm">AI Optimized</Badge>
          <RefinedCvView markdown={matchedCv} />
        </Card>
      }
      aside={
        <>
          <MatchScoreBlock result={result} compact />
          <KeyEnhancementsBlock enhancements={extractEnhancements(matchedCv, result)} />
          <RefineToolsBlock />
        </>
      }
    />
  );
}
```

**Shared UI consumed:** `PageHeader`, `Card`, `MarkdownView`, `Button`, `CircularProgress`, `Badge`, `EmptyState`, `LoadingState`.

**Business logic:**
- `refined-cv-view.tsx`: `MarkdownView markdown={matchedCv}` styled as a document (variant="document").
- `key-enhancements-block.tsx`: parses LLM-returned `keyEnhancements` array → `Card`-list with icon + bold title + muted description.
- `refine-tools-block.tsx`: tone `Select` (professional/conversational/concise), length `Select` (shorter/balanced/longer), extra instructions `Input`, "Regenerate" `Button` → calls `/api/generate-cv` (Phase 06).
- `refined-cv-actions.tsx`: "Download .md" + "Download .html" `Button`s. **No PDF Phase 1** (replaces Stitch "Download PDF").

**Replaced from Stitch:**
- "Download PDF" button → "Download .md" + "Download .html" (parent unresolved Q4).
- "Generate Cover Letter" Pro Tip card → hidden Phase 1 (parent unresolved Q5).

### 5–7. Stub Tabs (History / Optimizations / Career Path)

**Layout:** `DashboardLayout` (correct `activeNav` prop per route)
**Composition:**
```tsx
// src/app/(app)/history/page.tsx
export default function HistoryPage() {
  return (
    <DashboardLayout activeNav="history" topnavTitle="History">
      <EmptyState
        icon={<Icon name="history" size={48} />}
        title="History — coming soon"
        description="Phase 2 will let you save and revisit past analyses."
      />
    </DashboardLayout>
  );
}
```

Repeat for `/optimizations` (icon `auto_fix_high`) and `/career-path` (icon `psychology`).

## Stores + Types

### `src/features/analyze/types.ts`
```ts
export type RoleFamily = 'auto' | 'data_engineer' | 'data_platform' | 'manager' | 'pm_delivery' | 'solution' | 'software' | 'other';
export type Strictness = 'balanced' | 'strict' | 'friendly';
export type Language = 'en' | 'vi' | 'auto';
export type Provider = 'gemini' | 'openai' | 'custom';
export type Decision = 'strong' | 'good' | 'stretch' | 'low';

export type AnalysisResult = {
  overallScore: number;
  decision: Decision;
  summary: string;
  cvVisibility: number;
  realExperience: number;
  risk: number;
  screeningPass: number;
  interviewReadiness: number;
  atsKeyword: number;
  metrics: Array<{ name: string; score: number; weight: number; reason: string }>;
  strengths: string[];
  gaps: Array<{ title: string; severity: 'critical' | 'moderate' | 'minor'; type: 'wording' | 'real'; recommendation: string }>;
  redFlags: string[];
  coverage: Array<{ requirement: string; status: 'match' | 'partial' | 'missing'; evidence: string }>;
  recommendations: Array<{ priority: number; action: string; rationale: string }>;
  atsKeywords: string[];
  targetRoleLabel?: string;
};
```

### `src/features/analyze/settings-store.ts`
Zustand + persist; BYOK key only persisted when `rememberKey === true`. Schema versioned: `cv-ex-settings-v1`.

### `src/features/analyze/analysis-store.ts`
Zustand transient (no persist — PII). Holds `jdText`, `jdUrl`, `cvText`, `targetRole`, `strictness`, `language`, `weights`, `result`, `matchedCv`, `isAnalyzing`, `isGeneratingCv`, `error`.

### `src/features/analyze/file-parsers.ts`
```ts
export async function parseFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'txt') return file.text();
  if (ext === 'docx' || ext === 'pdf') {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/parse', { method: 'POST', body: fd });
    if (!res.ok) throw new Error(`Parse failed: ${res.status}`);
    const data = await res.json();
    return data.text;
  }
  throw new Error('Unsupported file format');
}
```

### `src/features/analyze/api-client.ts`
Stubs for `callAnalyze`, `callGenerateCv`. Return mock data Phase 1 if needed for visual testing; real wire-up in Phase 06.

## Implementation Steps (03c)

1. **03.5 Login:** create `sign-in-form.tsx` + `app/(auth)/sign-in/page.tsx`. Verify renders inside `AuthLayout`.
2. **03.6 Analyze:** create stores + types + file-parsers + api-client first. Then 4 input blocks. Then `analyze-page.tsx` composition. Then `app/(app)/page.tsx`.
3. **03.7 Results:** create 4 result blocks + `results-page.tsx`. Mount inline below Analyze when `result !== null`.
4. **03.8 Refined CV:** create 4 refined-cv blocks + `refined-cv-page.tsx` + `app/(app)/refined-cv/page.tsx`.
5. **03.9 Stubs:** 3 stub route files, each < 20 LOC.
6. Run Pre-Finalization Scan Checklist (parent phase-03 file).

## Todo List

### Auth (03.5)
- [ ] `features/auth/sign-in-form.tsx` < 200 LOC
- [ ] `app/(auth)/sign-in/page.tsx` wraps with `AuthLayout`
- [ ] Google sign-in button wired to Auth.js v5
- [ ] "Enter as Guest" link → `/?mode=byok`
- [ ] Email magic link disabled Phase 1 (tooltip explains)

### Analyze (03.6)
- [ ] `features/analyze/types.ts`
- [ ] `features/analyze/settings-store.ts` Zustand + persist + version
- [ ] `features/analyze/analysis-store.ts` Zustand transient
- [ ] `features/analyze/file-parsers.ts`
- [ ] `features/analyze/api-client.ts` callAnalyze + callGenerateCv stubs
- [ ] `features/analyze/cv-input-block.tsx`
- [ ] `features/analyze/jd-input-block.tsx`
- [ ] `features/analyze/analysis-parameters-block.tsx`
- [ ] `features/analyze/settings-panel-block.tsx`
- [ ] `features/analyze/analyze-cta.tsx`
- [ ] `features/analyze/analyze-page.tsx` composes layout + blocks
- [ ] `app/(app)/layout.tsx` wraps with DashboardLayout (reads session)
- [ ] `app/(app)/page.tsx` renders AnalyzePage + ResultsPage (conditional)

### Results (03.7)
- [ ] `features/results/match-score-block.tsx`
- [ ] `features/results/optimization-paths-block.tsx`
- [ ] `features/results/keyword-coverage-block.tsx`
- [ ] `features/results/recommendations-block.tsx`
- [ ] `features/results/interview-questions-stub.tsx` EmptyState
- [ ] `features/results/results-page.tsx` composes DetailPanelLayout

### Refined CV (03.8)
- [ ] `features/refined-cv/refined-cv-view.tsx`
- [ ] `features/refined-cv/key-enhancements-block.tsx`
- [ ] `features/refined-cv/refine-tools-block.tsx`
- [ ] `features/refined-cv/refined-cv-actions.tsx` (.md + .html download)
- [ ] `features/refined-cv/refined-cv-page.tsx`
- [ ] `app/(app)/refined-cv/page.tsx`

### Stubs (03.9)
- [ ] `app/(app)/history/page.tsx` — DashboardLayout + EmptyState
- [ ] `app/(app)/optimizations/page.tsx`
- [ ] `app/(app)/career-path/page.tsx`

### Verify
- [ ] Every feature file imports visual primitives ONLY from `@/components/ui` and `@/components/layouts`
- [ ] Grep feature folder for `bg-#`, `text-#`, hex literals → zero matches
- [ ] Grep for `<aside`, `<nav class=` outside layouts → zero matches
- [ ] Grep for `TODO`, `FIXME`, `console.log`, `// AI` → zero matches
- [ ] Every page < 200 LOC; blocks < 200 LOC
- [ ] Token edit smoke test: change `tokens.colors.secondary` → all 4 screens reflect
- [ ] `pnpm tsc --noEmit` clean
- [ ] `pnpm build` clean
- [ ] `pnpm lint` clean

## Success Criteria

- Login renders Stitch design parity (centered card + bg pattern + atmospheric shapes).
- Analyze renders Stitch design parity (sidebar + dream-role headline + bento grid CV/JD + 3-slider parameters + sticky CTA).
- Results renders Stitch design parity when `result !== null` (Match Score ring + optimization cards + keyword chips).
- Refined CV renders Stitch design parity (markdown document main + Match Score aside + Key Enhancements aside).
- 3 stub tabs render `DashboardLayout` + `EmptyState` "Coming soon — Phase 2".
- BYOK toggle works: typing key + Remember → reload → key persists; unchecking Remember → reload → key gone.
- Click Analyze → fetch `/api/analyze` (returns 404 until Phase 06; UI handles via `ErrorState`).
- No file in `features/` redeclares `<button className="bg-...">` or `<div className="rounded-... bg-white shadow...">`; all use `Button` / `Card` from shared UI.
- Visual diff with Stitch screens < 5%.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Dev hardcodes a one-off color in a block | High | High | CI grep step blocks hex literals outside `lib/design-tokens.ts`; reviewer enforces |
| `analyze-page.tsx` becomes too big (composing 5+ blocks) | Med | Med | Each block in own file < 200 LOC; page is pure composition < 50 LOC |
| Refined CV markdown parsing breaks on edge cases (lists, code blocks) | Med | Low | `react-markdown` + `remark-gfm` standard; fall back to raw `<pre>` if parser errors |
| Stitch design drift unresolvable (Pro CTA, Cover Letter, PDF) | Resolved | — | See parent unresolved Q2/Q4/Q5 — proposals locked |
| Mobile breakpoint mismatch between Analyze grid (lg) and Results grid (xl) | Med | Low | Document chosen breakpoint per page in component comment |
| Results inline-render breaks Analyze CTA "calculating" feedback | Low | Med | Use `LoadingState` overlay inside `ResultsPage` block; Analyze CTA disables during in-flight |
| BYOK key accidentally persisted when `rememberKey === false` | High | High | Zustand `partialize` strips `apiKey` from persist when `!rememberKey`; unit test covers |

## Backwards Compatibility

- Settings store schema version `cv-ex-settings-v1`; bump to `v2` requires Zustand `migrate()` function.
- Analysis store not persisted — no migration concerns.

## Security Considerations

- BYOK `apiKey` never sent to `/api/analyze` when `useSharedKey === true`. Enforced by request builder in `api-client.ts`:
  ```ts
  const payload = useSharedKey
    ? { ...rest }  // omit apiKey
    : { ...rest, apiKey };
  ```
- BYOK key input field: `type="password"`, `autoComplete="off"`, no logging.
- File upload size pre-check `< 4.5MB` before network call.
- No PII (CV/JD content) sent to any analytics SDK.
- Markdown rendering: `react-markdown` default sanitization; do NOT enable `rehype-raw`.

## Rollback Plan

- Each feature folder is isolated. Rollback per screen:
  - Revert `features/auth/` + `app/(auth)/sign-in/page.tsx` → Login broken, rest fine.
  - Revert `features/analyze/` + `app/(app)/page.tsx` → Analyze broken, Login + Refined CV + stubs fine.
  - Revert `features/results/` → Analyze still works, just no results render.
  - Revert `features/refined-cv/` + `app/(app)/refined-cv/page.tsx` → Refined CV unreachable, rest fine.
  - Revert any stub page → that route 404s, rest fine.

## Test Matrix

| Test | Target | When |
|------|--------|------|
| Unit | `settings-store` persist + clear when `rememberKey` toggles | After 03.6 |
| Unit | `analysis-store` state transitions (idle → analyzing → result / error) | After 03.6 |
| Unit | `parseFile()` routes .txt client-side, .pdf/.docx to /api/parse | After 03.6 |
| Unit | `api-client.callAnalyze` omits `apiKey` when `useSharedKey=true` | After 03.6 |
| Integration | Analyze page composes correct shared UI (no inline visual primitives) | After 03.6 |
| Integration | Results renders inline below Analyze when result populated | After 03.7 |
| Integration | Refined CV renders markdown + aside; download buttons trigger blob download | After 03.8 |
| Visual diff | Each screen vs Stitch mockup screenshot | After 03.5–03.8 each |
| Token propagation | Change `tokens.colors.secondary` → 4-screen diff shows uniform color update | End of 03c |
| Build | `pnpm build` clean | After every sub-phase |

## Next Steps

- Phase 04 (parse API) makes `.pdf/.docx` upload work end-to-end.
- Phase 05 (scrape API) makes JD URL input return real text.
- Phase 06 (LLM endpoints) makes Analyze button return real `AnalysisResult` and "Generate Matched CV" button return markdown.
- Phase 07 (quota) populates the `topnavActions` slot of `DashboardLayout` with a quota counter `Badge`.
- Phase 08 (i18n) wraps strings in `t(...)` — purely a string-replace pass.

## Unresolved Questions

- **Inline Results vs separate route** — proposed inline (Stitch flow). Confirm; if separate `/results` route preferred, `analysis-store` persists `result` and route reads from store.
- **MatchScoreBlock `compact` variant in Refined CV aside** — needs `CircularProgress` size prop value; proposed 96px. Confirm.
- **Refined CV markdown parsing for diff-added segments** — Stitch shows green-highlighted "added" lines via `.diff-added` class. Phase 1 LLM response unlikely to return diff markers; proposed: render plain markdown, skip diff highlighting Phase 1. Confirm.
- **Refine tools "Regenerate" Button** — currently wired to Phase 06 endpoint. Phase 1 visual-only state: disable button with tooltip "Available after analysis"? Proposed yes.

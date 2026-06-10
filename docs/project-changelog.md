# Project Changelog

## 2026-06-10 — LLM prompt redesign + Gemini 503 hotfix + i18n harness + Job Fit kill-switch (16 commits + 1 revert)

Single-session ship. Plans + audit reports referenced from prior sessions remain live: `plans/reports/audit-260609-1539-llm-prompts.md`, `plans/260610-1015-llm-prompts-redesign/*`.

### Prod hotfix burst (morning, 7 commits)
- **`07591de`** — Google deprecated `gemini-2.0-flash` (404 NOT_FOUND). Every shared-key LLM call returned 502. Swap default model to `gemini-flash-latest` in `settings-store.ts` + bump persist version 3→4 with migrate rewriting stale `gemini-2.0-flash` to the new default. `model-prices.ts` adds the alias entry. Affected /api/analyze, /api/jd-insights, /api/generate-cv, /api/career-path, /api/extract-must-haves, /api/role-infer, /api/generate-cover-letter, /api/companies/[slug]/enrichment.
- **`cf4b5d7`** — jsdom@29 transitive `html-encoding-sniffer@6 → @exodus/bytes` (ESM-only) crashes Vercel serverless with `ERR_REQUIRE_ESM` at runtime. URL JD import via `itviec /companies/...` triggered the Readability fallback path. Replaced jsdom + `@mozilla/readability` with cheerio (pure-CJS, no native deps). Quality drop on fallback acceptable — known sources still hit JSON-LD first. Itviec parser test 11/11 green.
- **`38a3c8f`** — Cross-user cache leak on shared browser. NextAuth signout is a server action that redirects, no client hook fires → localStorage + sessionStorage survive identity transitions. New `useUserIdGuard` hook (mounted in AppShell) tracks current `session.user.id` against a marker and purges all per-user storage (`cv-ex-settings-v1`, `cv-ex-career-path-v1`, `cv-ex-analysis-v1..v4`, `job-fit-matches:v2`, `refined-cv-text:v1`, `cv-ex-analysis-banner-dismissed`) on A→B / A→null transitions. Anon → first signin does NOT purge. 8/8 cases tested.
- **`f8532bd`** — JD Matching gauge stuck at 0/STRETCH despite per-dim bars at 65/65/90. Prompt rule #11 told LLM not to emit `overallScore` (client computes it) but `result.overallScore` was being read directly. Mirror v3 cv-analyze pattern: `recomputeOverall(hydrateWeightsFromResult(result))`. "Silent error after Run" symptom was the gauge sitting on 0.
- **`cdfd0bc`** — Reader-view HTML preservation lost in `cf4b5d7`. Cheerio fallback now sanitizes inner HTML of main node (allowlist of safe attrs, drops `javascript:`/`data:`/`vbscript:` URIs, force `a[href]` → `target=_blank rel=noopener`) and passes through as `article.html`. Source JD card reader view restored.
- **`05318fe`** — Cheerio fallback on unstructured pages (itviec /companies/) yielded wall-of-divs without h1/ul/etc → prose-CSS arbitrary selectors didn't match. Replace `ReaderArticle` with `<iframe srcdoc>` + embedded reader stylesheet — native browser UA layout + total CSS isolation from app shell. Sandbox + `<base target=_blank>` for safe link handling.
- **`72360e0`** — Swap-JD disclosure below results. After a JD Match completes the import panel hides; user had to close the browser to swap. Native `<details>` section below results with the import panel + Run button.

### LLM prompt redesign Phase 1a–1d + Phase 2 (5 commits)

- **`202cd61` Phase 1a — Refined CV polish** — v2 parity port from v3: VERB_BANK + metric formatting + skill grouping + `---` section dividers + `viRegisterLock` + extraInstructions HARD-RULES sanitizer wrapper. `MODE_INSTR.apply` gets optimization budget (≤40% rewrite). Block 2 Refine Notes gets `### Mode` h3 as first section. Schema adds `aspirationRole?` + `additionalSections?` (mirror v3). UI: `RefineToolsBlock` adds Aspiration role text input pre-filled from `useCareerPath((s)=>s.targetRole)` when non-empty + non-'auto'. 22/22 tests pass.
- **`5001e52` Phase 1b — Scoring tightening + drop friendly** — v3: 4-anchor calibration per dim (`Anchors: 30 = ... | 60 = ... | 85 = ... | 95 = ...`) + recruiter persona system prompt + rule #9 rewritten (`detectedRole` MUST echo input) + VN register block. v2: strictness tiered into concrete score-delta (strict subtracts ~10 from intuition; balanced reports as-is) + JD Step-0 industry tagging + new `roleAlignment: {aligned, note}` schema field + rule #8 forces distinct coverage vs must-haves + VN register block. `StrictnessEnum` narrowed to `['balanced','strict']` — `friendly` dropped. `analysis-store` `onRehydrateStorage` coerces legacy `'friendly'` → `'balanced'` silently. Normalizer passthrough for `roleAlignment`. 31/31 tests pass.
- **`d4948ff` Phase 1c — Job Fit hardening** — Prompt adds 9-dim rubric + mustHaves per candidate (cap overallScore at 65 when CV clearly misses a must-have) + ≥1 negative matchReason rule for sub-80 scores + studyTopics must filter against CV evidence (senior candidate → deep-dive/adjacent, no basics) + description truncation hint at 800 chars + LLM emits tier S/A/B/C/D/E (boundaries aligned with `tierFromScore`). `estimatedHours` schema migrates from string to `{min,max}`; normalizer accepts both during 2-week transition (drop string fallback 2026-06-24). Server still authoritative on tier via `tierFromScore`; LLM drift logged via `console.warn`. 17/17 tests pass.
- **`4c40715` Phase 1d — Cover Letter** — 4 tone preset (warm / professional / concise / leadership) with VI + EN addendum maps. 3-band length (short 150-200 / medium 250-400 / long 400-550 words). Optional `strengthsToLead?: string[]` (top 2 from analyze) + `gapToAddress?: string` (top critical gap, opt-in checkbox). System prompt branches by language (`resolveLanguage` uses Vietnamese diacritic density heuristic when 'auto'). `sanitizeMarkdownInline` strips `[]*#` ` `<>` from `jobTitle`+`company` to keep h1 clean. UI: `CoverLetterBlock` adds Tone + Length dropdowns + "Address top critical gap" checkbox; auto-prefills `strengthsToLead` from `analyzeResult?.strengths.slice(0,2)`. 24/24 tests pass.
- **`bfa8aad` Phase 2 — Roadmap specificity + industry + structured ambitionGap** — Operator locked: KEEP `gemini-flash-latest` (no model bump). Prompt-only. Few-shot Staff Engineer @ fintech example block in system prompt. New optional `inputs.industry?` (max 80 chars) → emits `=== INDUSTRY ANCHOR ===` block instructing vertical-specific milestones/skillGaps. Specificity rubric: every `skillGap.howToLearn` MUST contain (course OR book OR mentor) + (project OR repo OR artifact) + (timeline). `feasibility` schema: drop `gentleAdvice` softness → structured `ambitionGap` (1-sentence factual) + `requiredSteps` (2-4 concrete bridge steps). `quickWins` items become `{action, effortHours, outcome}` triples. `alternativePaths` ≥1 enforced (normalizer injects transparent stub if LLM returns 0). Legacy `gentleAdvice` → `ambitionGap` fallback in normalizer for cached responses. UI: `quick-wins-block` renders 2-line entry (action + ~Nh + outcome); `feasibility-banner` uses `ambitionGap` headline + `requiredSteps` list. 21/21 tests pass.

### Infra phases (3 commits)

- **`27b4d35` Phase 8 — KV decommission** — Drop `JOBFIT_USE_POSTGRES` env flag + the 404 admin-lockdown gate from `/api/jobs/recommend`. Remove legacy KV imports (`topKCandidates`, `JobIndexNotReadyError`, `kvGetJobBatch`, `getJobIdsForVertical`). Inline the Postgres branch in `topKByEmbedding` + `getJobBatch` sites. `applyTierGate` now always applied. `markSeenForUser` condition narrowed to `(session.user.id && matchedJobs)`. Operator follow-ups (not in this commit): unset Vercel env, run cleanup scripts, delete dead files.
- **`d909f2d` Phase 9 — Scrape optimization** — `extractItemListEntries` returns `{url, name?}` (was URL-only); handles both ITviec direct shape + TopCV nested SearchResultsPage shape. New `--title-include kw1,kw2` + `--title-exclude kw1,kw2` flags on `ingest-itviec`: case-insensitive substring match on slug + name. Pagination tail detection still compares pre-filter count so aggressive filters don't truncate early. Stats per page log parsed/filtered/kept/fresh. 8/8 tests on jsonld-itemlist.
- **`2924161` LLM retry+fallback chain** — Gemini upstream returning intermittent 503 UNAVAILABLE ("high demand") — verified via direct probe (flash-latest 503, 2.5-flash 200, 2.5-pro 503; rotates by hour). New `callLLMWithFallback` in `providers.ts`: retry SAME model once on transient (regex over 429/50[023]/UNAVAILABLE/overload/rate-limit/INTERNAL) after 600ms; then walk `geminiFallbackChain` (returns 2.5-flash → flash-latest → 2.5-pro minus current). Non-transient errors bubble. Wired into `/api/jobs/recommend` (`callRecommendLlm`) + `/api/analyze` (v2 + v3 via `handle-v3`). 8/8 cases.

### Career Path UX + v2 todayIso (`edb8f74`)
- Aspiration form jumping to top after roadmap exists → render `<AspirationInputBlock>` inside the bottom "Lộ trình hiện tại" card with a top-border divider. Edit→regenerate flow stays on single scroll position.
- AI-suggest button ("AI đề xuất 3-5 hướng") only existed in pre-result Start Card → mirrored into post-result card so users can access path suggestions after generating.
- v2 `prompt-generate-cv.ts` + `prompt-analyze.ts` were missing the `=== TODAY'S DATE ===` block that v3 had. JD Matching → Refined CV flagged "Mar 2026" as future date red flag; same input on Analyze → Refined (v3) did not. Same shape ported into both v2 prompts.

### i18n in-house harness (3 commits)
- **`4cc1983` morning** — Global LLM output language toggle added to Settings drawer (mirrors the inline analyze form picker so the preference is reachable from every workflow).
- **`fac306a` batch 1** — `src/lib/i18n/messages.ts` carries ~80 keys for VI + EN sub-bundles (nav, settings, common buttons, language picker, career-path page, refined-cv, cover-letter, jd-matching, analyze). `src/lib/i18n/use-t.ts` exposes `useT()` hook that resolves locale from `useAnalysis(s.language)` ('auto' → 'vi'). Wired: user-menu (signIn/signOut), career-path-page (header + empty state + start card + suggest button + custom-aspiration toggle + loading + error + current-roadmap card + note prefix), jd-matching-content (ready empty-state, run CTA, loading, error, swap-JD disclosure). 9/9 i18n catalog parity + interpolation tests.
- **`df60062` batch 2** — Wired into settings drawer + trigger (title + LanguagePreferenceRow), refined-cv refine-tools-block (controls title + Tone + Length + Aspiration role + Extra instructions + Regenerate CTA), cover-letter-block (Generate Cover Letter + tones + length + Address Gap checkbox + Generate + `quotaRemaining` with vars interp), dashboard sidebar nav (Dashboard + My CVs + Analyze + JD Matching + History + Help + Privacy; admin pages keep `rawLabel`).

Why in-house vs `next-intl`: next-intl needs middleware + locale-routed URLs to do this canonically (multi-day rewire). Product is Vietnamese-first with one explicit user-controlled language toggle — in-house t() reads the same store the toggle writes, instant switching without URL changes. Server components default to VI since they can't read the client store; translate at the client boundary (most user-facing copy already is client-side).

Deferred: analyze form (page header + run CTA), upgrade page, sign-in, dashboard cards, JD import panel, admin pages.

### Job Fit shared-key bypass — reverted (`e0b0468` → `7e24d63`)
- Initially built admin-controlled bypass of `DISABLE_SHARED_KEY` gate for `/api/jobs/recommend`. Operator clarified: Job Fit must NOT use shared key for non-admin — users have to BYOK. Reverted entire commit + deleted the KV flag.

### Job Fit admin kill-switch (`6042a7a`)
- New KV flag `flag:job-fit-enabled` (default ON, fail-OPEN on KV outage — opposite of `DISABLE_SHARED_KEY`). Admin POST `/api/admin/job-fit-flag {action:'on'|'off'}` toggles + cache reset. New `JobFitFlagToggle` UI section on `/admin/maintenance` alongside Maintenance + Public login.
- 4 enforcement points when flag OFF: (1) `/api/jobs/recommend` returns early 503 'service_unavailable' before session/quota work; (2) `cv-analyze/[cvId]/layout.tsx` + `jd-matching/[cvId]/layout.tsx` read `isJobFitEnabled()` server-side and forward `jobFitEnabled` prop to `WorkflowLayout`; (3) `workflow-layout.tsx` `buildSteps` filter drops `jobfit` chevron step when flag off OR viewer non-admin; (4) `/job-fit/layout.tsx` `notFound()` — admin path included for testable off-state. 5s in-process cache for propagation.

### Stats
**Status:** ✓ Shipped to main. 16 commits + 1 revert (`07591de` → `6042a7a`). 608/608 tests passing / 25 skipped.

### Operator runbook
- **Manual pool refresh**: `pnpm run seed-pool` (full sweep: TopCV + ITviec + expire pass, ~25-40 min wall-clock).
- **Subflags**: `pnpm run seed-pool -- --pages 2`, `--max-age-days 5`, `--skip-itviec`, `--skip-topcv`.
- **Single-source**: `pnpm run ingest itviec data-engineer senior-data-engineer --pages 2 [--title-include senior,lead] [--title-exclude intern,fresher]`.
- **Stats**: `pnpm run ingest stats` (pre/post counts by vertical/seniority).
- **Expire pass only**: `pnpm run ingest expire` (mark `verifiedAt >21d` as expired).

### Deferred (priority order for next session)
1. **Billing + credits + shared-key open for Job Fit** (operator targeted 2026-06-11) — Enable cost-tracking when normal users use shared key on Job Fit recommend; per-user credit ledger + ledger debit on each Gemini call.
2. **i18n batch 3** — analyze form, upgrade page, sign-in, dashboard cards, JD import panel, admin pages. Pattern proven; mechanical.
3. **Soak reviews** — Phase 1c must-have cap-65 rule after 1 week; `estimatedHours` legacy string fallback removal scheduled 2026-06-24; Phase 2 `quickWins.effortHours` distribution tune.
4. **Operator KV cleanup** — Unset `JOBFIT_USE_POSTGRES` on Vercel, run `kv-snapshot` + `kv-drop-jobs-keys`, delete legacy `src/lib/jobs/{repo.ts, score.ts KV-bound parts, vertical-index.ts, pack-embeddings.ts}`.
5. **Per-endpoint LLM fallback expansion** — Extend `callLLMWithFallback` from recommend+analyze to generate-cv + career-path + generate-cover-letter + extract-must-haves + jd-insights so transient Gemini 503 doesn't surface on any LLM endpoint.

---

## 2026-06-09 — Job Fit UX overhaul + CV-orphan auth fix + prompt audit (17 commits)

Single-session ship across 17 commits (`ad70004` → `3d5ba09`). Reports at `plans/reports/audit-260609-1539-llm-prompts.md` (prompt audit) and `plans/reports/research-260609-1620-openai-pricing-estimate.md` (GPT-5 cost matrix). State snapshot in [[project_cvmatching_v01_state]] memory.

### Auth — CV orphan bug definitively fixed (4 commits)
- Diagnosed: NextAuth v5 beta-31 + JWT strategy + no DB adapter generates a fresh random UUID for `user.id` per OAuth round-trip. Admin verified two distinct UUIDs across logout/login on the same Google account → all `user_cvs` rows orphaned.
- `54977cf` shipped Google `profile()` override anchoring `user.id = profile.sub`, plus a 3-source priority chain in the JWT callback (`profile.sub | account.providerAccountId | user.id`). Diagnostic log emits all candidates per sign-in event for ops visibility.
- `919fb69` shipped `ensureUserRow` cascade-delete on email conflict — the orphan row with same email + different id collided on `users.email UNIQUE` and broke CV upload with 500.
- Admin verified: same id across cycles, CVs preserved.
- See [[feedback_nextauth_v5_random_user_id]] + [[feedback_users_email_unique_orphan]].

### Job Fit UX — 4 user-flagged issues bundled (`5dde8a1`)
- **Chevron auto-pickup CV** — `JobFitListPage` accepts `cvText` + `cvName` props from `[cvId]/[step]/page.tsx` instead of relying on stale sessionStorage. New "Đang match với CV: {name}" banner makes active CV obvious.
- **Apply ngay opens external URL** — S/A tier action targets `job.sourceUrl` in a new tab instead of routing to `/refined-cv` (which was confusing — label implies the actual job posting).
- **Inline detail expand** — new `JobFitInlineDetail` renders the full dossier (CompanyCard, MustHaveBlock, JobScoreBlock, MatchReasonsBlock, StudyTopicsBlock, CoverLetterBlock, DetailActionsBar) directly under the selected card with `?jobId=X` URL sync via `router.replace`. Legacy `/job-fit/[id]` route preserved.
- **Clearer labels** — B tier "Quick Fix" → "Refine cho job này"; C tier "Improve CV" → "Polish CV (stretch)".

### Roadmap UX (`813b3e0`)
- Error states scoped per action — `PathSuggestionsBlock` only takes over the full card when no cached suggestions; otherwise inline retry banner. `CareerPathPage` generate-error becomes an inline dismissible alert.
- `CareerPathActions` button label aware of aspiration change: "Rebuild roadmap → {suggestion}" when user picks new direction after a roadmap exists; else "Regenerate current roadmap".

### PDF export — full rewrite (3 commits)
- `6d62b1b` swapped `window.print()` (which grabbed app chrome) for `html2canvas` + `jsPDF`.
- Production broke immediately: Tailwind v4 emits `oklch()` colors which `html2canvas` 1.x can't parse → silent failure.
- `de17df5` swapped to `html-to-image` (`toPng` via SVG `<foreignObject>` = browser-native render = any CSS the browser understands works). Targets `.refined-cv-print-target article` only; multi-page split for content > 1 letter page; libs dynamic-imported.
- Error message now surfaces exception detail so users can report root cause directly.
- See [[feedback_html2canvas_oklch_tailwind_v4]].

### Workflow layout stability (`ad70004` + `0b52127` + `c27b8aa`)
- `WorkflowLayout` consolidated top/left variants into a single stable JSX tree (one `<main>` + `<aside>` + `<section>` with class toggles, no branching). Source CV `<iframe>` now persists across chevron step navigation — no PDF re-fetch. User-visible "lag lag" resolved.
- `JdMatchingSourceArea` always renders the grid with both CV + JD cards; non-match steps hide JD via `hidden` class.
- 3 related bugs caught:
  - `c27b8aa` — function-form `sourceLayout` prop from server → client component throws 500 (RSC can't serialize functions). Pushed decision into client component (`usePathname`-derived). See [[feedback_rsc_no_function_props]].
  - `0b52127` — destructure default `sourceLayout = 'left'` short-circuited the `??` nullish-coalescing fallback. Removed default so `undefined` cascades. See [[feedback_default_param_short_circuits_nullish]].
  - [[feedback_react_stable_jsx_tree]] documents the iframe-remount root cause.

### Prompt audit + 9-dim universal labels (`c8237f1` + `3d5ba09`)
- Audit report covers 8 prompt surfaces with per-surface recommendations + 4-phase ship plan.
- `c8237f1` shipped Phase 1a partial — schema fields (`aspirationRole`, `additionalSections`) + decoration rules in `prompt-generate-cv-v3` (verb bank, metric formatting, section dividers, Vietnamese register lock). UI wiring deferred.
- `3d5ba09` shipped Option B for 9-dim: keep internal keys (`coreSkill / tool / production / …`) for schema compat; broaden prompt descriptions + UI labels to be role-agnostic. Sales/Marketing/HR CVs no longer read "Production" as a tech-only signal.
- Pricing report at `plans/reports/research-260609-1620-openai-pricing-estimate.md` — caveat: absolute USD numbers ~6× too high (agent miscalc); ratios between models directionally correct.

### Token tracking — 3 attribution gaps closed (`a903a76`)
- `'company-enrich'` added to `UsageAction` enum + `logLlmCall` wired in route → admin/usage now counts enrichment activity per user.
- `handle-v3` role-infer success path now logs (was under-counting per-user analyze totals by 10-20%).
- Ingest scripts get `event:ingest_llm_call` structured stdout log so operator can grep total ingest spend from local runs.
- See [[feedback_token_tracking_coverage]].

### Other fixes
- `79e210c` — removed "Enter as Guest" link (redirect loop — guest BYOK flow was lost in IA refactor and not restored).
- `61a23f3` — whitelisted `lh3.googleusercontent.com` in `images.remotePatterns` so Google profile avatars load via `next/image`.
- `59e23bb` — hotfix `package.json` trailing-comma after removing `pnpm` config block (broke Vercel build).

### Tests + deployment

- 469 passing / 25 skipped (was 363/10 on 06-05).
- All 17 deploys ready in production; latest HEAD `3d5ba09`.
- Production URL: `https://resume-refactor.vercel.app`.

### Deferred (next session priority order)

1. **VN/EN i18n toggle** — `next-intl` in deps, ~12h plan A-E. App currently mixes Vietnamese + English.
2. **Phase 1b/1c/1d** from prompt audit — Scoring calibration anchors, JD-match v2 distinct coverage + role mismatch flag + drop `strictness=friendly`, Cover Letter 4 tone variants.
3. **Phase 2** — Roadmap prompt-only fixes (operator chose: keep `gemini-2.0-flash`, fix prompt first; defer model bump).
4. **Refined CV aspiration UI** — Phase 1a shipped prompt + schema; UI input field + auto-flow from Career Path store deferred.
5. **Job Fit dim rebalance** — `location` often empty → score noise. Defer until non-tech audience grows.
6. **Role-family dim variants** (Option A from audit) — revisit if non-tech CV audience grows.
7. **Pricing rollout** — per-user billing blocked until VN/EN toggle ships + token tracking stable in prod for ≥1 week.

---

## v0.4.0 — CV-Solo Analyze pivot — 2026-06-04

Single-session ship across 8 commits (`ea2c6e1` → `4950932` + docs sync). Plan: `plans/260604-1356-v04-cv-solo-analyze-pivot/`. Full deviations + follow-ups documented in [[project_v04_pivot_cv_solo_analyze]] memory.

### Pivot summary

- `/analyze` no longer requires JD input — CV-only paste
- LLM infers target role from CV (`role-infer.ts` + `role-infer-prompt.ts`); confidence ≥ 0.75 → score immediately; below → return `needsRoleConfirm` + candidates, UI opens modal so user picks/types
- 9-dim scoring rescoped from "CV-vs-JD match" → "CV-intrinsic per-dim quality for claimed role" (mechanics identical: sliders editable, overallScore recomputes client-side, frozen artifacts)
- Must-have requirements: removed from `/analyze`; plumbed on Job Fit detail via conditional-render `MustHaveBlock` (waits silently for ingest to populate `Job.mustHaves[]`)
- Cover Letter: new shortcut CTA on Job Fit detail → `/refined-cv?jobId=X&intent=cover-letter` → existing `CoverLetterBlock` auto-scrolls into view
- Cache: `cv-ex-analysis-v1` → `cv-ex-analysis-v2` with `ReAnalyzeBanner` on `/analyze` (user-driven re-analyze; never auto-burn quota per decision #4)
- Quota unchanged: 5/day analyze, 3/day cover letter
- v2 code path retained for rollback safety; dispatcher in `route.ts` routes by body shape

### API contract changes

- `POST /api/analyze` now accepts both shapes; v3 = `{ llm, inputs: { cvText, language, role?, profileText? } }` (no `jdText`)
- New 502 error code `role_infer_parse_failed` / `role_infer_invalid_shape` / `role_infer_provider_error` surface per [[feedback_error_surfacing_no_silent_fallback]]
- New response field: `schemaVersion: 'v3'`, `inferredRole?: {canonical, confidence}`, `targetRole: string`
- `needsRoleConfirm` response shape: `{ schemaVersion: 'v3', needsRoleConfirm: true, candidates: [...], quotaRemaining }`

### Tests

74 new unit tests across phases (role-infer 24, dispatcher 7, v3 client 4, v3 prompt 13, must-have-block 3, cache-migration 13, +10 existing tweaks). Suite: 254 passed / 10 skipped. tsc clean throughout.

### Follow-ups (next sessions)

1. Preview env smoke of v0.4 paths (≤15 min)
2. Hard-delete v2 code post-smoke (prompt-analyze.ts, jd-input-block.tsx, must-haves-block.tsx, AnalyzeInputs schema fields, dispatcher v2 branch)
3. Ingest enhancement to populate `Job.mustHaves[]` so the Job Fit detail block lights up
4. 20-CV role-infer accuracy benchmark — tune `ROLE_INFER_CONFIDENCE_THRESHOLD` env if needed
5. Pilot reopen runbook (unblocked now that pivot shipped per decision #6)

---

## Post-Wave-A hardening — 2026-06-03 evening

Wave A shipped in the afternoon (entry below); the evening session added
latency fixes, a refine-notes split that prevented meta leakage into
downloaded CVs, the foundation for the multi-vertical ingest taxonomy
(Phase 1 of 5), and a Dashboard landing page with the project tagline.

### Recommend latency: 504 → ~15-20s (commits `1027f5d`, `79c283b`, `6807047`, `8e2a710`)

After Wave A bumped the recommend output to 10-15 jobs with full
dimensionScores + study topics + the new few-shot prompt, `/api/jobs/recommend`
hit the 60s Vercel maxDuration. Vercel logs showed `generateContent: 54.23s`
on Gemini 2.5 Flash. Root cause was the 2.5-series default thinking budget,
not output size. Fixes layered in order:

- topK `10 → 6` in route.ts; dropped 16K → 24K retry path in
  `llm-call-with-retry.ts`; cut the 11-job worked-example block from the
  recommend prompt to shed ~500 input tokens.
- Added `disableThinking` opt threading through `callGemini → providers →
  callLLM`. Set `thinkingConfig.thinkingBudget: 0` for `job-recommend`,
  `generate-cv`, `generate-cover-letter`. Left thinking ON for
  `career-path` (genuinely open-ended roadmap reasoning) and `analyze`.
- Surfaced a `pool: { cvVertical, verticalApplied, verticalBucketSize,
  candidatesScored }` block in the recommend response so devtools shows
  which path the request took. Dropped UI underfill threshold 10 → 6 to
  match topK so the footer doesn't permanently scream "underfilled".
- vl24h slug map tightened: `khoa-hoc-ky-thuat`, `co-khi-o-to-tu-dong-hoa`,
  `dien-dien-tu-dien-lanh`, `buu-chinh-vien-thong` moved tech → other.
  Re-classified the 150 live prod jobs via REST + rebuilt vertical-index.
  Tech bucket 25 → 9 (still narrow; Phase 2-4 of the new plan fix the
  underlying pool composition).

### Refine notes split (commit `68fb45c`)

User reported that `## Changes Made` and `## Gaps To Address Before Interview`
sections were appearing INSIDE the rendered refined CV and inside the
downloaded `.md` file — meaning the candidate could ship internal meta
to recruiters as part of the CV.

Fix end-to-end:

- `prompt-generate-cv.ts` restructures OUTPUT FORMAT — model emits the CV,
  then a literal `<!--REFINE-NOTES-->` line, then meta as `### Changes
  Made` + `### Gaps To Address Before Interview`. Mode addenda (fill-gaps,
  stretch) now point the LLM at the notes block, not the CV body.
- `app/api/generate-cv/route.ts:splitCvAndNotes()` splits at the marker
  first; falls back to the first `## Changes Made` / `## Gaps To Address`
  h2 for legacy outputs. Response now `{markdown, refineNotes, quotaRemaining}`.
- `callGenerateCv` api-client returns `{markdown, refineNotes}`. Three
  call sites (results-section, refine-tools-block, refined-cv-mode-banner)
  store both into `analysis-store` (which gains `refineNotes: string | null`).
- `refined-cv-view.tsx` renders the CV in its existing Card, then refine
  notes as a separate primary-bordered Card labelled "Refine notes · Chỉ
  cho bạn — KHÔNG nằm trong CV gửi recruiter".
- `download-actions.tsx` untouched — it only reads `matchedCv`, which is
  now CV-only after the split, so `.md` downloads are clean.

### Admin usage row ordering (commit `5023348`)

Visit history and Daily volume tables on `/admin/usage` rendered
oldest-first because the underlying arrays are built that way for
cumulative math. Wrapped each `.map` in `[...arr].reverse().map(...)` so
today's row sits at the top. Totals (which use the original array order
via `.reduce`) unaffected.

### Ingest taxonomy Phase 1 (commits `8e2a710`, `da3578c`)

User flagged the architectural rule: "filter BEFORE scrape, never broad-
scrape-then-reclassify; cover all 6 verticals; bilingual VN + EN; research-
driven." Memory `feedback-filter-before-scrape` captures the rule.

Five sibling researcher agents produced taxonomy md files for tech,
marketing, finance, sales, ops, other (each 450-825 lines covering
sub-domains, bilingual title patterns, confirming keywords, source slug
maps, and negative-filter rules). A planner synthesised the master plan
+ 5 phase files at `plans/260603-1655-ingest-taxonomy/`.

Code shipped this evening (Phase 1 of 5):

- `src/lib/jobs/taxonomy.ts` (~330 lines) — single source of truth.
  `TAXONOMY` constant: 6 verticals × 47 sub-domains. Each sub-domain
  carries (id, vertical, titlesPositive regex, sourceSlugs per board).
  Each vertical carries a titlesNegative regex evaluated BEFORE the
  positive list. Exposes `classifyTitle(vertical, title)`,
  `pickSubVertical(title)`, `slugToVerticalAndSub(source, slug)`.
- `src/lib/jobs/types.ts` — `subVertical?: string` added to `Job` and
  `JobInput`. Optional so 150 live prod records read fine with the new
  shape; new ingests carry it from the filter step.
- `tests/taxonomy.test.ts` — 56 assertions: slug coverage per vertical,
  30 positive-title fixtures (Senior Backend Nodejs, Data Engineer, ML
  Engineer, DBA, Kế Toán Tổng Hợp, Môi Giới BĐS, Bác Sĩ, Kỹ Sư Cơ Khí, …),
  12 negative rejections, 4 cross-vertical routing checks (Sales Engineer
  → sales not tech, Insurance Sales → sales not finance, Kỹ Sư Cơ Khí →
  other not tech, clean Data Engineer → tech.data).

Regex gotcha solved during test bring-up: Node V24's `\b` doesn't fire
on Vietnamese diacritic boundaries even with the `u` flag. Stripped all
`\b` from the taxonomy regexes and rely on substring matching within
parenthesised alternations — false-positive risk on short keywords kept
under control by alternation context.

Phases 2-5 (vl24h pre-filter rewrite → multi-board topcv+vnw → re-ingest
→ weekly cron + relax freshness ≤7d) deferred to next session. Total
remaining effort ≈ 12-17h.

### Dashboard landing page (commit `4daec0a`)

`/` (root) used to render the Analyze form directly. Now serves a
Dashboard with the project tagline as the first-impression hero:

> AI giúp bạn **chọn đúng job**, **sửa đúng CV**, **biết gap thật**, và
> tăng xác suất được gọi phỏng vấn. Còn lại **vẫn là khả năng của bạn**.

Hero uses a gradient + radial-blob background, the four action verbs
highlighted in the tertiary-container token, the closing phrase set
apart in bold with a 4px underline so the personal-accountability
message lands. Primary CTA is a large "Start Analyze →" button routing
to /analyze. Below the hero: a 4-card grid pairing each verb with a
one-line explanation of the feature that delivers it (tier system,
refine mode, red flags split, cover letter + roadmap). Secondary CTA
at the bottom.

Routing:
- `/(app)/page.tsx` renders `<DashboardPage />`
- new `/(app)/analyze/page.tsx` renders `<AnalyzePage />`
- sidebar gains a top "Dashboard" item; "Analyze" now points `/analyze`
- empty-state CTAs in career-path, job-fit, refined-cv updated `/` → `/analyze`

Backward compat: existing bookmarks of `/` land on Dashboard and one
click reaches Analyze. `sessionStorage` keys/serialization unchanged.

### Dashboard hero polish (commit `e2f7f4f`)

User reported the "Còn lại / vẫn là khả năng của bạn." hero on `/`
overflowed: diacritics on row 2 (`ạ`, `ả`, `ă`) plus the 6px underline
crashed into row 3. Root cause: `sm:text-[5.5rem]` (88px) at
`leading-[0.95]` set the rendered line height (~84px) below the cap
height + descender + underline-offset budget. Fix: scale 36→48→60px
across `text-[2.25rem] sm:text-[3rem] lg:text-[3.75rem]`, leading-[1.15]
(comfortable above cap height for Vietnamese diacritic stack), underline
decoration-[3px] underline-offset-[6px] (modern, doesn't intrude). Hero
still dominant, balanced, no overflow.

### Ingest taxonomy Phase 2 — vl24h pre-filter rewrite (commit `3bcb2ab`)

Phase 2 of 5 of the `260603-1655-ingest-taxonomy` plan. Implements the
"filter at URL slug + URL title-slug BEFORE detail HTTP" architectural
rule (memory `feedback-filter-before-scrape`).

Pipeline changes in `scripts/scrape-vl24h.ts`:
- Pre-filter pass over the sitemap output drops URLs at two cheap gates
  before ANY detail fetch: (1) category slug must appear in some
  sub-domain's `taxonomy.sourceSlugs.vl24h`; (2) URL title-slug
  (extracted from the `/<cat>/<title-slug>-cNNN…html` shape, folded
  dash→space, lowercased) must pass the candidate sub-domain's positive
  regex without hitting the vertical-wide negative.
- Pre-filter logs total survivors and per-vertical counters
  (`survived`, `rejNeg`, `rejNoMatch`) BEFORE the detail loop so an
  aborted run still shows the rejection breakdown.
- Detail-fetch loop re-classifies on the canonical `ld.title` (richer
  than the URL slug which truncates at ~60 chars). Accepts the refined
  sub-vertical or rejects on detail-stage negative-match
  (`rejectedAtDetail` counter).

Supporting code changes:
- `src/lib/scrape/vl24h-parser.ts` — dropped the hardcoded
  `SLUG_VERTICAL` map (taxonomy.ts is now the single source). Added
  `extractTitleSlugFromUrl(url)` + `foldAndDeslug(slug)`. `ldToJobInput`
  signature gains an optional `subVertical: string` arg and emits it on
  the returned `VlJobInput`.
- `src/lib/jobs/classify.ts` — new `classifyVerticalAndSub(title,
  company)` runs `taxonomy.pickSubVertical()` first, falls back to the
  legacy regex cascade for titles taxonomy doesn't cover (HR/PM/
  coordinator etc). `classifyVertical()` kept as a wrapper that returns
  just the vertical, preserving the 19 existing call-sites.
- `scripts/ingest-file.ts` + `scripts/ingest-paste.ts` — wire
  `subVertical` from the classifier (or from `entry.subVertical` when
  the scrape pipeline already resolved it) through to the saved Job.
- `src/lib/jobs/taxonomy.ts` — word-boundary fix on the bare short
  tokens in `tech.data` (`bi|ba|dba`) and `tech.ml-ai` (`ml|ai|llm|nlp`).
  Bare `ai` was matching the `ai` inside `chAIn`, which classified
  "Supply Chain Specialist" as tech.ml-ai. Now `\bai\b` etc.
- `classify-vertical.test.ts` updated: "HR Business Partner" → ops.hr
  (taxonomy promoted HR from `other` to `ops.hr`; semantically correct).
- `tests/vl24h-parser.test.ts` (new) — covers the URL extractors +
  fold helper with positive / negative / malformed cases.

Verification: `tsc --noEmit` clean. `vitest run` full suite 180 / 180
passed, 10 skipped (unchanged).

Live verification deferred to next session — needs network: dry-run on
prod sitemap (`pnpm tsx scripts/scrape-vl24h.ts --dry-run --limit 50
--max-age-days 3`) + 20-URL spot-check per vertical against acceptance
target (≥50 surviving / vertical, zero false-positives in tech).

Phase 3 (multi-board topcv+vnw integration, stretch), Phase 4 (wipe
prod KV + re-ingest, DESTRUCTIVE — needs explicit operator go-ahead),
and Phase 5 (cron taxonomy top-up integration) remain deferred.

## Wave A — 2026-06-03 (Fit Tier UX overhaul, all phases EOD)

Plan `260603-1359-wave-a-fit-tier` (5 phases, est. 19-29h) shipped in one
session. Adds tier classification across recommend → refine → roadmap flow;
surfaces honest red-flag warnings; introduces cover-letter endpoint (7th cost
bucket).

### Fit-tier system (Phase 1-2)

- **`src/lib/jobs/fit-tier.ts`** — pure server logic: `TierLetter` (S/A/B/C/D/E),
  `tierFromScore()` (cliffs at 95/85/75/65/55), `QUOTA = {S:1, A:3, B:2, C:2,
  D:1, E:1}` (max 10), `enforceQuota()` (caps per tier, never cross-fills).
- **`src/lib/llm/prompt-job-recommend.ts`** — system prompt now asks for 10-15
  jobs across full 0-100 score range, max 3 study topics per job, anti-cluster
  instruction ("KHÔNG dồn cụm 80-85"). Drops the legacy `>80` filter.
  Includes a worked-example block (12-candidate fintech pool, ~11 distinct
  scores from 35 → 96) to hedge Gemini's known clustering bias around 80-85.
- **`src/lib/llm/normalize-job-recommend.ts`** — derives `tier` server-side from
  `overallScore`, sorts desc, calls `enforceQuota` before return. Loosens
  `studyTopics.min` from 3 → 1 (low-tier jobs naturally emit fewer). Adds
  `description` to `JobMatchOut` so refine-from-job runs without re-fetch.
- **`<TierBadge>`** atom (`src/components/ui/tier-badge.tsx`) — letter chip
  with semantic tooltip (`title=` attribute) + per-tier color map.
- **`<RedFlagsSection>`** (`src/features/analyze/red-flags-section.tsx`) — inline
  section under analyze tabs when `result.redFlags.length > 0`.
- **`<RedFlagsBanner>`** (`src/features/refined-cv/red-flags-banner.tsx`) —
  collapsible amber banner top of /refined-cv.
- **Job-fit list page** — groups by tier (S→E) with icon + count headings;
  underfill footer "Chỉ N/10 jobs match. Thêm jobs ngày mai" when `<10`.
- **SessionStorage cache** `job-fit-matches:v1 → v2` (pre-tier caches lacked
  the new field; v2 invalidation prevents Phase 2 undefined crashes).

### Action column (Phase 3)

- **`<ActionButton>`** (`src/features/job-fit/action-button.tsx`) — per-tier
  CTA: S/A → `/refined-cv?jobId&mode=apply` (primary); B → `mode=fill-gaps`;
  C → `mode=stretch` (secondary intent); D/E → `/career-path?target&skillGaps`.
- **`detail-actions-bar.tsx`** refactored — takes `job: JobMatchOut`, hides
  "Mở trên source" link for tier D/E (low-fit → not pushing user to source).
- **`GenerateCvBody.inputs.mode`** added to schema + `prompt-generate-cv.ts`
  appends a `=== MODE ===` block with apply/fill-gaps/stretch instructions
  (read AFTER the HARD RULES so it never overrides "DO NOT invent").
- **`<RefinedCvModeBanner>`** (`src/features/refined-cv/refined-cv-mode-banner.tsx`)
  — client island, reads `?jobId&mode` via `useSearchParams`, looks up job in
  `useJobFit` store, synthesizes `analysisSummary` from `matchReasons +
  studyTopics`, click-to-generate (no auto-fire — same cost-discipline as
  cover letter; user explicitly confirms).
- **`career-path-page.tsx`** — reads `?target&skillGaps`, seeds `targetRole`,
  selects suggestion, appends gap list into `notes`. Route wrapped in
  `<Suspense>` for `useSearchParams` compliance.

### Cover Letter endpoint (Phase 4)

- **`POST /api/generate-cover-letter`** — mirrors `generate-cv` exactly:
  zod-validated body, `resolveApiKey` with action `'generate-cover-letter'`,
  kill-switch gate (shared key only), `callLLM`, `logLlmCall`, `recordCost`
  gated `!byok`. BYOK + admin bypass identical to other LLM routes.
- **System prompt** — 3-paragraph structure (hook → evidence → close), 250-400
  word target, no fabrication, no generic phrases ("passionate" / "team
  player"), no `Dear Hiring Manager` greeting (user adds manually).
- **Cost bucket** — 7th bucket `'generate-cover-letter'` added to
  `lib/cost/buckets.ts`. Same $1 WARN / $3 KILL thresholds (`cost/guard.ts`).
- **Quota** — `3/day` for logged-in users; `0` for anonymous (login-gate via
  resolveApiKey at line 62 returns 401 before quota path).
- **Admin usage** — `DailyGlobalRow` adds `generateCoverLetterOk/Error`;
  `/admin/usage` daily table adds "Cover Ltr ok / err" column.
- **`<CoverLetterBlock>`** (`src/features/refined-cv/cover-letter-block.tsx`)
  — replaces `cover-letter-stub.tsx` (deleted); reads `?jobId` for context,
  click-to-generate, renders `MarkdownView`, shows remaining quota.

### Verification

- `npx tsc --noEmit` clean across all phases.
- `vitest`: 111 passed, 10 skipped, 0 failed (rewrote 2 normalize tests to
  reflect new tier+quota behavior).
- `next build`: clean, `/api/generate-cover-letter` ƒ-registered.
- Deferred (Phase 5 noted): auto-fire-on-arrival for mode banner (cost-guard
  headroom unproven); `/api/jobs/{id}` lookup endpoint (banner falls back to
  store-empty hint).

### Cross-plan

- `260603-1205-ui-polish/plan.md` updated with "Wave A handoff" section listing
  4 new components that need token-ification.

## v0.3.1 — 2026-06-02 evening (pilot lockdown + ops UX)

Post-ship session. Real prod KV seeded with 150 vl24h jobs; multiple
operational hardenings; admin UX polish ahead of opening shared key
to public users once usage analysis on the ultra-tier API key completes.

### Auth & cost lockdown

- **Anonymous shared-key removed** (`resolve-api-key.ts`): guests now get 401
  `auth_required` instead of consuming the shared `GEMINI_API_KEY` with the
  IP-based stricter quota. Anyone reaching the LLM must either log in via
  Google or paste their own key via BYOK Settings drawer.
- **Email-based admin allowlist** (`ADMIN_USER_EMAILS` env): added alongside
  the existing `ADMIN_USER_IDS` (Google sub) check. Operators can promote a
  teammate by adding their gmail without first asking them to log in. New
  `isAdminUser(session.user)` aggregates both checks; six call sites
  migrated (admin/* layout, job-fit/* layout, refined-cv-page CTA gate,
  export-usage handler, recommend handler, app-shell sidebar flag).
- **Three-layer admin bypass**:
  1. `DISABLE_SHARED_KEY=1` env — admin keeps shared-key path (resolveApiKey
     skips the env check when caller is admin).
  2. `kill-switch:*` KV flags — admin skips the per-bucket cost gate in all
     four LLM routes (`analyze`, `generate-cv`, `career-path`, `job-recommend`).
  3. Maintenance flag — proxy.ts decodes the NextAuth JWT cookie and lets
     admins through the 503 page.
- **Public login gated** by `login:enabled` KV flag (fail-CLOSED):
  `/sign-in` returns 404 when off; topnav login button hidden; guests have
  no UI path to OAuth. Admin sessions bypass.
- **Site-wide maintenance toggle** via `maintenance:mode` KV flag — proxy.ts
  returns 503 + Vietnamese maintenance HTML on every page navigation.
  Admin bypasses via JWT.

### Operator surfaces

- **Admin UI**: `/admin/maintenance` rebranded to "Site Controls"; toggles
  for both maintenance and public login. Bypass-aware so admin never locks
  themselves out.
- **CLI scripts** (read `.env.local`):
  - `pnpm run kill-switch status | on <bucket> | off <bucket> | --all`
  - `pnpm run maintenance status | on | off`
  - `pnpm run login-flag status | on | off`
- **Diagnostic endpoint**: `GET /api/whoami` returns the caller's session
  shape + admin status. Non-admin response redacts env hints; admin
  response includes `adminEmailsLower` for misconfig debugging.

### Latency & quality

- **Job Fit recommend pipeline**:
  - `topKCandidates` cut from K=20 → K=10 (~50% LLM time saving).
  - Prompt asks 3-5 jobs × 3-5 study topics (was 5-10 × 5-10).
  - `callRecommendLlm` bumps `maxOutputTokens` 10K/12K → 16K/24K + extracts
    Gemini `finishReason`. Errors now classify into `MAX_TOKENS`, `SAFETY`,
    or generic with raw output excerpt for admin debugging.
  - Internal deadline at `maxDuration - 5s` propagates an AbortSignal
    through `embedText`, `callGemini`, `callLLM` — Vercel no longer kills
    the function before our catch returns a structured error.
- **Job Fit list page**: removed mount-time auto-refetch that burned a
  Gemini call on every revisit after the 6h cache expired. Now requires
  an explicit "Tìm job phù hợp" click; cached results render instantly.
- **User-facing errors**: list page no longer leaks Gemini/JSON/token
  wording — shows "Đề xuất job thất bại — Hệ thống đang gặp sự cố. Vui
  lòng thử lại sau." regardless of underlying cause. Admins still get the
  full code + detail in the network response.

### Embedding & job data

- **Gemini API migration**: `text-embedding-004` deprecation broke
  `/api/jobs/recommend` in prod (500 from embedContent 404). Swapped to
  `gemini-embedding-001` with `outputDimensionality: 768` + manual L2
  normalization at `embedText` return (model output is not unit-length
  when dimensionality is truncated; `cosineSim` assumes L2-normalized).
  One-shot migration `scripts/normalize-stored-embeddings.ts` re-normalized
  the 150 existing stored vectors (avg prior L2 = 0.59).
- **Latent KV bug fixed**: `loadBlobChunks` did `JSON.parse(idsRaw)` on
  what TS believed was a string, but Upstash REST auto-parses
  JSON-stringified values on `get` — the array came back already parsed,
  so JSON.parse threw SyntaxError. Surfaced for the first time today
  when the embeddings blob was populated in prod.
- **vieclam24h.vn scraper**: TopCV/ITviec/JobsGO are Cloudflare-blocked
  at the TLS-fingerprint layer; vl24h returns 200 with Schema.org
  JobPosting ld+json on detail pages. New `scripts/scrape-vl24h.ts` +
  parser library yields 150 real Vietnamese jobs across 6 verticals
  (25 each: tech, marketing, finance, sales, ops, other).
- **Vertical taxonomy**: extended `Job.source` enum with `'vl24h'`;
  `classifySeniority` learned Vietnamese patterns (`trưởng phòng/nhóm/ban`,
  `giám đốc`, `cao cấp`). Migration `scripts/backfill-vl24h-source.ts`
  retagged the 150 existing rows and re-classified seniority — 3 jobs
  bumped from `mid` to `lead` post-patterns.

### UI polish

- **Sidebar flattened**: dropped Start/Outputs/Archive/Admin group headings;
  flat list in workflow order (Analyze → Refined CV → Career Path → History
  → admin-only items). Admin-only is now a per-item `adminOnly` flag.
- **Job Fit & Study moved to admin-only** during the v0.3 KV-seed pilot;
  hidden from non-admin sidebar + CTA + page route + handler.
- **Refined CV** added to sidebar (was reachable only from Analyze results).
- **Empty-state CTAs** for Refined CV / Career Path / Job Fit all point
  back to `/` (Analyze) instead of hopping through each other — flatter,
  less circular flow.
- **Optimizations entry** removed from sidebar (page is a Phase-2
  placeholder; real optimization features are tabs inside Analyze results).
- **Interview Questions** tab dropped from results — it rendered a stub.
- **Reset to AI scores** button now shows a 1.5s "✓ Đã reset về điểm AI"
  confirmation flash so users perceive the click even when their slider
  values already matched the AI scores (the no-op case that previously
  read as broken).
- **Logout button** hidden for guests (used to render unconditionally and
  send unauthed users into a confusing signout flow).

### Files added (selected)

- `scripts/scrape-vl24h.ts`, `scripts/cost-kill-switch.ts`,
  `scripts/maintenance-mode.ts`, `scripts/login-flag.ts`,
  `scripts/normalize-stored-embeddings.ts`, `scripts/backfill-vl24h-source.ts`
- `src/lib/scrape/vl24h-parser.ts`, `src/lib/maintenance/maintenance-mode.ts`,
  `src/lib/maintenance/login-flag.ts`, `src/lib/jobs/classify-cv-vertical.ts`,
  `src/lib/jobs/vertical-index.ts`
- `src/app/api/whoami/route.ts`, `src/app/api/admin/maintenance/route.ts`,
  `src/app/api/admin/login-flag/route.ts`,
  `src/app/(app)/admin/maintenance/page.tsx` (+ toggle components),
  `src/app/(app)/job-fit/layout.tsx`

### Open follow-ups

- Pre-filter recommend candidates by CV vertical (using
  `classifyCvVertical` + `vertical-index`) — library code written this
  session, not yet wired into the route. Would tighten match quality and
  shave another ~30-50% off LLM time if candidates drop to 5 from a denser
  same-vertical pool.
- Hybrid refresh cron with top-up scraping (deferred to
  `plans/260602-1739-hybrid-refresh-topup/`).
- `consumeQuotaForAnon` is dead code in the resolver path; remove in a
  cleanup commit.

---

## v0.3 — 2026-06-02 (Job Fit & Study + LLM batch recommendations)

### Features

#### Job Fit & Study (`/job-fit`, `/job-fit/[jobId]`)
- **Recommendation pipeline:** Single `/api/jobs/recommend` POST call returns 5-10 jobs matching CV, scored on 9 dimensions (tech skills, domain knowledge, seniority fit, learning curve, remote, growth, location, industry, soft skills).
- **Study topics per job:** Each recommendation includes 5-10 curated learning topics with tier (basic/intermediate/advanced), estimated hours, and job-specific rationale.
- **Job detail page:** Read-only 9-dim score sliders (user can override sliders client-side to recompute overall score, test match sensitivity).
- **Sidebar navigation:** Added "Job Fit & Study" as 5th nav item after Career Path.
- **Cursor redirect & engagement tracking:** User clicks "Apply" → `/api/r/[jobId]` → records click metric → 302 external redirect.
- **Topic dislike feedback:** User click "Không thích" on topic → `/api/topics/feedback` POST → aggregates dislike counters and logs.

Files added: 40+ across `src/lib/jobs/`, `src/features/job-fit/`, `src/app/api/jobs/`, `src/app/api/r/`, `src/app/api/topics/`, `src/components/job-*`.

#### Ingest CLI (`npm run ingest`)
- Interactive paste mode, file batch import, job stats display, manual expiry, embedding rebuild.
- 150-job seed dataset (80 tech, 30 marketing, 20 finance, 20 sales/ops) pre-embedded.
- Auto-classifies vertical (tech/finance/marketing/etc) + seniority (intern/junior/mid/senior/lead) from title + company.

#### Infrastructure

**Cost guard + kill-switch:**
- Per-bucket daily spend tracking (`metrics:cost:<YMD>:<bucket>`).
- Alert webhook fires at `ALERT_SHARED_DAILY_COST_USD` (default $2.50) and `ALERT_SHARED_DAILY_CALLS`.
- Hard kill-switch at $3/day cumulatively — endpoint returns 503 until cost guard manually reset.

**Cron refresh pipeline:**
- Vercel Cron Pro: `0 20 * * *` (20:00 UTC = 3am ICT) daily.
- HEAD/GET each job source URL; mark expired (404/410) or verify (200 + title match).
- Auto-archive jobs with `verifiedAt > 21 days`.
- Cursor-based resumable batch (150 jobs × 2s/req = ~5min, fits 300s deadline).
- Alert webhook if active pool < 50 jobs.

**New quota bucket:**
- `job-recommend`: 5 calls/day anon, 12 calls/day signed-in, unlimited BYOK.

**Environment variables added:**
- `EMBED_CACHE_SECRET`: HMAC key for CV embedding cache (TTL 6h).
- `CRON_SECRET`: Vercel cron auth Bearer token (auto-injected on Pro tier).
- `ALERT_WEBHOOK_URL`: Optional Slack/Discord webhook for cost/pool warnings.

### Privacy & Documentation

**Docs expanded (v0.3 blocking):**
- `docs/privacy.md`: All 6 sections now include concrete KV keys, TTLs, deletion process, and new GDPR-aligned "takedown channel" email + 7-day SLA.
- `docs/deployment.md`: Full runbook with env var table, KV inventory (18 key patterns), quota bucket table, phase rollback procedure, smoke checklist.
- `docs/system-architecture.md`: New "Job Fit & Study" subsection with data-flow diagram (Mermaid), cost reference, privacy reference.
- `docs/development-roadmap.md`: v0.3 marked shipped; post-ship monitoring 2-week window (30% activation, 40% engagement, <15% dislike, 15% CTR).

### Testing

- Unit tests: cosine similarity, embedding pack/unpack roundtrip, vertical + seniority classifiers, normalization, refresh batch with mocked fetch.
- Schema tests: recommend body validation, topic feedback strict schema (rejects `reason` field).
- Integration smoke tests: recommend endpoint (env-gated), redirect 302, feedback 204/400.
- Smoke bash script: cacheable embed, hit redirect, invalid feedback rejection.
- Test coverage: 40+ test cases across 8 test files.

### Migration notes

**v0.2 → v0.3:**
- No data migration needed (KV-only, per-session CV text).
- New quota bucket `job-recommend` starts fresh (no historical data).
- `EMBED_CACHE_SECRET` required in production — rollback impossible without it.
- Cron schedule added to `vercel.ts` — type-check before deploying.

### Known limits & deferred

- **No playwright scraper** (v0.3a manual paste only; v0.3b planned for live scrapers).
- **No resource links per topic** (planned v0.3.5 to reduce hallucination risk).
- **No auth-tied job history** (client-side sessionStorage only; persistent tracking deferred to v0.4).
- **Topic feedback counters only** — no free-text reason field (privacy-first approach).

### Commits

- P0 hardening: `2bea204`
- P1 ingest + seed: `2b4692a`
- P2 recommend endpoint: `e16e802`
- P3 UI pages: `fe97bd5`
- P4 cron + redirect + feedback: `aaf7470`
- P5 tests + docs + smoke: `[commit hash TBD on merge]`

---

## v0.2 — 2026-05-28 (Career Path + UX hardening)

### Features

#### Career Path (`/career-path`)
Phase 2 stub replaced with full feature.
- **Auto-suggest paths**: on landing with analyzed CV, AI proposes 3-5 concrete role suggestions across trajectories (specialist / leadership / pivot / breadth). User picks one to focus the roadmap.
- **Roadmap generator**: per-aspiration LLM call returns structured response — `currentSnapshot`, `targetRole` (with fit score), 3-6 milestones (year offset, role, responsibilities, skills, evidence, certifications), skill gaps with current→target level meter, alternative paths, 30/60/90-day quick wins.
- **Natural mode vs targeted mode**: prompt detects whether aspiration is empty (`auto` target, no focus areas, no notes) → instructs LLM to infer natural progression from CV trajectory. Otherwise builds toward stated aspiration.
- **Feasibility check**: LLM judges feasibility first; unrealistic aspirations get a warm tertiary banner + pragmatic alternative + still renders a usable roadmap toward the alternative (no hard-fail).
- **Per-page state**: `useCareerPath` Zustand store persists to sessionStorage. Suggestion cache keyed by first 200 chars of CV — auto-invalidates when user re-analyzes a different CV.

Files:
- `src/app/api/career-path/{route.ts, suggest/route.ts}`
- `src/features/career-path/*.tsx` (8 blocks + store + actions + page)
- `src/lib/llm/{prompt-career-path, prompt-suggest-paths, normalize-career-path, normalize-suggest-paths}.ts`

#### Visit counter (header)
KV-backed analytics visible in topbar as social-proof / pilot metric.
- `proxy.ts` increments counters fire-and-forget on each real page nav (matcher already excludes API/static/prefetch).
- Unique-visitor dedup via Redis `SADD` against per-day IP set — reliable on Upstash @vercel/kv.
- `GET /api/visits` returns `{ total, totalUnique, today, todayUnique }`, edge-cached 30s.
- `VisitsBadge` polls every 60s, displays unique count (falls back to total page views).
- Privacy: IP only stored as transient dedup marker (1-day TTL), never as identity.

Files: `src/lib/analytics/visit-counter.ts`, `src/app/api/visits/route.ts`, `src/features/nav/visits-badge.tsx`

### Infrastructure

- **Upstash KV reconnected to production** (`KV_REST_API_URL`, `KV_REST_API_TOKEN`, etc.). Previous deploy lost the integration → BYOK vault returning 503 and quota fail-open. Re-linked via Vercel Storage tab.
- **New quota bucket**: `career-path` (3/day signed-in, 2/day anon). `career-path-suggest` is passthrough (no quota debit) with 10/min IP rate limit instead.
- **Token budget buff**: `callLLM` accepts `maxOutputTokens` per-call. Career-path roadmap uses 24576 Gemini / 8192 OpenAI; suggest uses 4096 / 2048. Prevents JSON truncation on larger schemas.
- **Git auto-deploy unblocked**: pushes to `main` now auto-deploy (previous Git Author Trust block resolved).

### UX fixes

- **Nav state preserved across pages**: sidebar now uses `next/link` instead of raw `<a href>` — was triggering full page reload that wiped zustand stores. Analyzing a CV then navigating to Career Path no longer loses `cvText` / `result`.
- **Analyze state persists across F5**: `useAnalysis` store now wraps in `persist` middleware against sessionStorage. Survives reload within the same tab; auto-clears on tab close (privacy: CV text doesn't linger for the next user on a shared device).
- **Primary CTA visibility**:
  - Brand `primary` token softened from pure black `#000000` → tertiary blue `#3980f4`. Every enabled CTA (Analyze, Generate Roadmap, Go to Analyze...) now reads as an action color, not a harsh black box. Section header labels (`text-primary`) also blue now — visually consistent.
  - `primary-container` / `on-primary-container` realigned to the same blue family (were inverted: dark navy + medium gray → text invisible).
  - Disabled state uses `bg-surface-container-high text-primary/60 border border-primary/25` — clearly distinct from enabled, still readable, still recognisable as primary action waiting to enable.
- **Aspiration toggle is now a proper `Button variant="secondary"`** instead of a link-style raw `<button>`.
- **Quota badge removed from topbar** — it added clutter; replaced with visit counter as the more meaningful signal.

### Error handling

- **`humanizeLlmError` extracted to `src/lib/llm/humanize-error.ts`** — analyze, generate-cv, and career-path api-clients all consume it (DRY). Friendly Vietnamese messages for timeout / network / 401-403 / 429 / 5xx / JSON truncation / "high demand". Career-path no longer surfaces raw `Gemini 503: { error: ... }` payloads.
- **`resolve-api-key` missing-shared-key status**: returned 500 + `llm_provider_error`, now 503 + `shared_key_disabled` with actionable message pointing to Settings → BYOK. Aligns HTTP semantics (server config, not internal error).
- **Career-path empty-payload guard**: relaxed. Previously hard-failed when LLM returned 0 milestones. Now only fails when both milestones AND feasibility advice are empty — lets the LLM return a banner-only response for genuinely-unrealistic aspirations.

### Deferred (non-blocking)

- `src/lib/usage/read-usage.ts` admin aggregation doesn't include `career-path` / `career-path-suggest` keys yet → admin dashboard underreports those endpoints. Counters write to KV correctly; only the read-side aggregation is missing.
- `docs/deployment.md` doesn't yet document the new quota buckets or the visit-counter KV keys. Update before next deploy doc revision.
- Visit counter `totalUnique` shows 0 for visits that landed before SADD-based dedup deployed — data loss is historical and won't backfill. Going forward unique tracking is accurate.

---

## v0.1 — 2026-05-27 (Pilot launch)

See `memory/project_cvmatching_v01_state.md` for full v0.1 state. Brief:

- Pilot deployed via Vercel CLI; BYOK vault (AES-GCM + KV TTL 4h + httpOnly cookie); anonymous shared-key path with per-IP quota (3 analyze + 1 rewrite/day); CSP `strict-dynamic` + nonce + HSTS 2y; admin dashboard at `/admin/usage`; alert webhook thresholds.


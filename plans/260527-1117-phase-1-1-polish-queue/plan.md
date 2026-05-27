---
name: phase-1-1-polish-queue
title: Phase 1.1 — Polish Queue (post-v0.1 deploy)
status: pending
created: 2026-05-27
blockedBy: [phase-1-deploy]
---

# Phase 1.1 — Polish Queue

Items intentionally deferred during Phase 1 (Phase 04-08). Pick up after v0.1 ships and live usage data confirms priority.

## Queued items

### A. Full i18n migration (~4h)

**Deferred from Phase 08.** Current state: English UI labels + Vietnamese error messages (de-facto bilingual but inconsistent).

- Install `next-intl`, configure plugin in `next.config.ts`
- Cookie-based locale (`NEXT_LOCALE=vi|en`), default `vi`
- `messages/vi.json` + `messages/en.json` with mirror keys
- `<LocaleToggle>` in topnav
- Wrap every string in components — Phase 03 UI files, error messages from API routes
- Acceptance: zero hardcoded UI strings (audit grep), toggle persists across refresh

### B. UI/UX refinements

- Primary token `#000000` → softer accent (user feedback: nút Analyze "hút mắt đen")
- CV/JD parsed-text textarea visual polish (user feedback)
- Quota badge wider responsive variants
- Sidebar nav active-state contrast

### C. Sliders/scoring UX (queued from Phase 03d)

Already shipped in Phase 06+ refactor: sliders are LLM scores not user weights, recompute overall client-side. Remaining polish:
- Tooltip explaining "AI scored this dim based on JD requirements"
- Per-dim "AI: X → Your: Y" delta indicator when user overrides
- Reset button: animation feedback

### D. Operational hardening

- Sentry / Axiom integration for error tracking
- Vercel Analytics opt-in
- Auto-alert when KV daily commands > 20K (potential abuse)
- E2E test (Playwright) for the analyze flow

### E. Feature backlog (Phase 2 candidates — re-evaluate)

- Persistent analysis history (needs DB — Vercel Postgres or Supabase)
- Multi-CV compare
- Custom prompts/templates
- Resume builder from scratch
- LinkedIn import via OAuth
- PDF download for refined CV

## Triage rule

After v0.1 deploys + first week of live use:
1. If users complain about a polish item → promote to active sprint
2. If item has no friction signal → keep in queue
3. Re-eval after Phase 1.2 (post-deploy hotfixes settle)

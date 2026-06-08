# Phase 2 — Pool-Grounded Job Fit + Roadmap

**Priority:** P1 — kills generic advice
**Status:** Not started (depends on Phase 1 + pool ≥500/role)
**Estimated effort:** 1 day

## Context

- Audit: `plans/reports/researcher-260608-1235-llm-prompts-audit.md`
- Pool size constraint: see `plans/260606-1231-jobfit-db-pool-monetize/` Phase 9
- 332 jobs in PG today; tech=90, senior=22, tech.data≈0 (needs growth before grounding is useful)

## Insight

Today both Job Fit and Roadmap are **simulated**: LLM plays "expert recruiter" and invents what VN market looks like. We have 332 REAL JDs sitting in Postgres with `mustHaves[]` extracted at ingest. Inject them. Stop letting LLM hallucinate "needs AWS Solutions Architect cert" when no actual VN job in pool asks for it.

## Requirements

Functional:
- Job Fit: per scored job, inject job's own `mustHaves[]` into prompt so `recruiterView` cites real terms FROM THAT JD
- Roadmap: pre-LLM step queries pool for top-5 jobs matching `targetRole`, extracts dedup'd must-haves, injects as grounding context
- Roadmap milestones MUST reference at least 1 real company name OR real job title from pool
- `nextWeekActions[]` (new field) replaces vague `days30/60/90` long-tail — 5 actions in 7 days each with `proofArtifact: string`

Non-functional:
- PG query latency budget: ≤200ms for top-5 lookup (use existing pgvector + role index)
- Token cost: +~1K input per workflow (5 JD summaries × 200 tokens)
- No PG schema changes — `mustHaves[]` field already exists from v0.4 ingest

## Architecture

```
Job Fit flow (existing + new):
  1. Embed CV → vector search → top 6-12 jobs (UNCHANGED)
  2. NEW: enrich each candidate with mustHaves[] from PG row
  3. Build prompt: inject candidates with mustHaves, plus rule
     "recruiterView MUST cite at least 1 mustHave verbatim"
  4. Call LLM (UNCHANGED)

Roadmap flow (existing + new):
  1. NEW: pre-LLM query → SELECT title, company, vertical, mustHaves
        FROM jobs WHERE active AND role_matches(targetRole) LIMIT 5
  2. NEW: dedupe + rank must-haves by frequency across 5 JDs
  3. Build prompt: inject "5 real VN jobs hiring for [role] now: [...]
        Top must-haves: [...]
        Build roadmap so user can apply to ≥1 within 90 days"
  4. Call LLM (mostly UNCHANGED, schema extended)
```

## Related code files

To modify:
- `src/app/api/jobs/recommend/route.ts` — fetch `mustHaves[]` per candidate from PG before prompt build
- `src/lib/llm/prompt-job-recommend.ts` — schema unchanged; add grounding rule to system prompt
- `src/app/api/career-path/route.ts` — add pre-LLM PG query step
- `src/lib/llm/prompt-career-path.ts` — add `{realJobsContext}` placeholder + injection
- `src/lib/llm/prompt-career-path.ts` — schema: replace `quickWins.days30/60/90` with `nextWeekActions[]`
- `src/lib/db/queries/jobs-by-role.ts` (new ≤80 lines) — helper for top-5 grounding lookup

To verify:
- Existing `mustHaves` parser at ingest time (per v0.4) — confirm coverage on current 332 jobs

## Implementation steps

1. Audit existing `mustHaves` populated rate on PG `jobs` table (target: >70% of active)
2. If rate <70%: backfill must-haves before this phase (small script, separate task)
3. Write `src/lib/db/queries/jobs-by-role.ts` — single function: given role string, return top-5 active jobs with title/company/mustHaves
4. Modify Job Fit route to enrich candidates with mustHaves from query OR existing job row
5. Update Job Fit prompt rule: `recruiterView MUST cite ≥1 mustHave from THIS job verbatim`
6. Modify Roadmap route: call jobs-by-role(targetRole), pass to prompt builder
7. Rewrite Roadmap prompt section: inject 5-job context, demand milestones reference real titles
8. Schema migration: `quickWins.days30/60/90` → `nextWeekActions[{action, proofArtifact}]` (5 items)
9. Update Zod normalizers
10. Backwards-compat: keep `quickWins` field for 1 release as optional, deprecate in notes
11. Smoke test both endpoints with real CV + verify outputs cite real companies

## Todo

- [ ] Audit `mustHaves` coverage on PG (script: `pnpm tsx scripts/audit-musthaves-coverage.ts`)
- [ ] Backfill if needed (separate sub-task)
- [ ] Write `jobs-by-role.ts` helper
- [ ] Job Fit route: enrich candidates with mustHaves
- [ ] Update Job Fit prompt grounding rule
- [ ] Roadmap route: pre-LLM query injection
- [ ] Roadmap prompt: 5-job context block
- [ ] Schema: `nextWeekActions[]` add, `quickWins` mark optional
- [ ] Zod normalizers updated
- [ ] Manual smoke: confirm real company names appear in roadmap output
- [ ] Manual smoke: confirm Job Fit `recruiterView` cites JD terms

## Success criteria

- Roadmap output for any role mentions ≥3 real company names from pool
- Job Fit `recruiterView` for each job cites ≥1 mustHave verbatim from THAT job
- `nextWeekActions` rendered as 5 items with proof artifacts
- No regression in latency p95 (budget +1s acceptable)

## Risks

- **Pool too sparse for role** (e.g., tech.data has ~0 jobs) — pre-LLM query returns <3 results. Mitigation: fallback to "no grounding available — using role-baseline" path, surface warning in UI
- **mustHaves field stale or empty** — backfill needed first
- **LLM ignores grounding context** when pool data conflicts with training-data priors — mitigation: explicit "PREFER pool data over your priors" rule

## Security

- No new attack surface — internal PG read only, no user input changes
- mustHaves is operator-curated at ingest time, not user-supplied

## Dependencies

- BLOCKED ON: Phase 9 of `260606-1231-jobfit-db-pool-monetize/` (pool growth to ≥500/role)
- BLOCKED ON: Phase 1 of this plan (schema fields must exist first for UI consistency)

## Next steps

→ Phase 3: Refined CV ATS keyword inject + voice + interview prep

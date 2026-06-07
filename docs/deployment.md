# Deployment Guide — Vercel

Production deploy of ResumeRefine (the Next.js app under `cv-ex-refactor/`).

## Prerequisites

- Vercel account + CLI installed (`npm i -g vercel` or `pnpm dlx vercel --version`)
- GitHub CLI optional (`winget install --id GitHub.cli -e`)
- Google Cloud project with OAuth 2.0 Client ID (deferred for pilot — see §10)
- Gemini and/or OpenAI API key (shared-key path)
- Vercel KV (Upstash Redis) provisioned (quota + rate limit + BYOK vault + usage metering)

## 1. Link the repo to Vercel

```powershell
# IMPORTANT: link from repo root, NOT from cv-ex-refactor/
Set-Location C:\path\to\CVMatching
vercel link
```

In Vercel Dashboard → Project → **Settings → General**:
- Framework Preset: **Next.js**
- **Root Directory**: `cv-ex-refactor` ← required because app is in subfolder
- Production Branch: `main`

> Mismatched Root Directory + CLI cwd causes path doubling (e.g. `cv-ex-refactor/cv-ex-refactor`) and a build error. Either link from repo root with Root Directory = `cv-ex-refactor`, or link from `cv-ex-refactor/` with Root Directory empty. Don't mix.

## 2. Provision Vercel KV

1. Vercel Dashboard → project → **Storage** tab
2. **Create Database** → **Upstash Redis** (Marketplace) → Free tier → Connect to project

Auto-injects `KV_REST_API_URL` + `KV_REST_API_TOKEN` to all envs. Pull locally:
```powershell
vercel env pull .env.local
```

## 3. Configure environment variables

Vercel Dashboard → **Settings → Environment Variables**.

### Required for Production

| Variable | Scope | Purpose |
|---|---|---|
| `AUTH_SECRET` | Prod + preview | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Derives BYOK vault AES-GCM key. |
| `GEMINI_API_KEY` | Prod only | Shared-key LLM path. Analyze, career-path, job-fit endpoints. |
| `KV_REST_API_URL` | All | Auto-injected by Vercel KV. Upstash Redis endpoint. |
| `KV_REST_API_TOKEN` | All | Auto-injected by Vercel KV. Auth token for Upstash. |
| `EMBED_CACHE_SECRET` | Prod + preview | HMAC key for CV embedding cache (v0.3). Min 32 bytes. Rotate quarterly. |
| `CRON_SECRET` | Prod only | Bearer token for `/api/jobs/refresh` cron. Auto-injected on Vercel Pro. Min 16 chars for local testing. |
| `ADMIN_USER_IDS` | Prod + preview | Comma-separated email allowlist for `/admin/usage` dashboard. Blocking: if empty, dashboard returns 404. |
| `DATABASE_URL` | Prod + preview | Neon pooled (pgbouncer) URL. Auto-injected by Vercel Marketplace Neon. Used at runtime. |
| `DATABASE_URL_UNPOOLED` | Prod + preview | Neon direct URL (Sensitive — paste from Console after `vercel env pull` masks it). Used by `pnpm db:generate` / `db:migrate`. |
| `JOBFIT_USE_POSTGRES` | Prod | `1` = serve recommend from Postgres + tier gate. `0` / unset = legacy KV path. |
| `SEPAY_WEBHOOK_API_KEY` | Prod | Sensitive. Webhook auth (timing-safe). Get from SePay Dashboard → Webhook. ≥16 chars. |
| `SEPAY_ACCOUNT_NUMBER` | Prod | Bank account number receiving transfers. |
| `SEPAY_ACCOUNT_NAME` | Prod | Account holder name (e.g. `RESUMEREFINE`). |
| `SEPAY_BANK_NAME` | Prod | VietQR-recognized bank slug (e.g. `Vietcombank`). |
| `PAID_PLAN_PRICE_VND` | Prod | Pro plan price in VND. Default `99000`. Digits only. |
| `MONETIZATION_ENABLED` | Prod | **Default OFF.** Set `1` or `true` to enable SePay. When off: `/upgrade` redirects, webhook + checkout 503, nav link hidden, and any signed-in user is treated as `paid` (so they're not stuck at the 2-job free cap without an upgrade path). |

### Optional / Cost & Alerts

| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | (unset) | Fallback LLM provider if `GEMINI_API_KEY` absent. |
| `ALERT_WEBHOOK_URL` | (unset) | Slack/Discord webhook for cost/pool warnings. If unset, alerts silent. |
| `ALERT_SHARED_DAILY_COST_USD` | 2.50 | Fire alert when shared-key spend/day crosses this (USD). |
| `ALERT_SHARED_DAILY_CALLS` | 200 | Fire alert when shared-key calls/day cross this. |
| `DISABLE_SHARED_KEY` | (unset) | Set `1` to force BYOK-only mode (emergency kill-switch). |
| `LOG_LLM_DEBUG` | (unset) | Set `1` to log raw LLM output on parse failure (dev only — privacy concern in prod). |
| `CSP_REPORT_ONLY` | (unset) | Set `1` to send CSP header as `Report-Only` instead of enforcing (staging use). |

### Optional / feature flags

| Variable | Purpose |
|---|---|
| `DISABLE_SHARED_KEY=1` | Emergency kill switch — force BYOK only. |
| `LOG_LLM_DEBUG=1` | Log raw LLM output fragments on parse failure. **Keep unset in prod** (privacy). |
| `CSP_REPORT_ONLY=1` | Send CSP as `Report-Only` instead of enforcing. Use during staged rollout. |
| `ADMIN_USER_IDS=email1,email2` | Comma-separated allowlist for `/admin/usage` dashboard. |
| `ALERT_WEBHOOK_URL` | Slack/Discord/generic incoming-webhook URL. |
| `ALERT_SHARED_DAILY_CALLS=200` | Fire alert when shared-key calls/day cross this. |
| `ALERT_SHARED_DAILY_COST_USD=2.50` | Fire alert when shared-key $-spend/day crosses this. |

### Pilot mode (current)

- Sign-in UI hidden; shared-key path works for **anonymous** users with per-IP quota (3 analyses + 1 rewrite/day).
- BYOK works via vault: user pastes key once → server encrypts AES-GCM → httpOnly cookie carries opaque UUID. Key never appears in request payload/header on subsequent calls.
- Google OAuth (`GOOGLE_CLIENT_ID`/`SECRET`/`AUTH_URL`) **not required** for pilot. Re-enable when ready by un-hiding the sign-in entry in `user-menu.tsx`.

## 4. Configure Google OAuth callback (deferred for pilot)

When restoring sign-in:

Cloud Console → **Credentials** → your OAuth 2.0 Client → **Authorized redirect URIs**:
```
https://<your-vercel-domain>/api/auth/callback/google
```

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_URL` env vars + redeploy.

## 5. Deploy

```powershell
# From repo root if Root Directory = cv-ex-refactor (recommended)
Set-Location C:\path\to\CVMatching
vercel --prod
```

Or push to `main` if Git integration is **and** Git Author Trust is configured (see §11).

## 6. Smoke test (run after every deploy)

1. **Homepage** `/` → renders, "Match your profile to your dream role." visible
2. **/privacy** → renders 8 user-facing sections (no jargon)
3. **/help** → renders quick-start + FAQ
4. **Shared-key anonymous flow**: paste JD + CV (no sign-in) → Analyze → result within ~10s → quota badge shows `1/3 analyses · 0/1 rewrites`
5. **BYOK vault flow**:
   - Settings drawer → "Thêm key" → paste a real Gemini key → Lưu
   - **Check DevTools**: no `apiKey` in body/headers of subsequent `/api/analyze` calls — only `Cookie: byok-token=<uuid>` header set by browser
   - Analyze again → succeeds without consuming quota (badge disappears)
   - Settings → "Clear" → cookie removed, falls back to shared-key path
6. **9 sliders show LLM scores** after Analyze. Drag any → Overall recomputes client-side (no LLM call).
7. **Generate refined CV** → markdown view opens
8. **Friendly errors**: enter a fake BYOK key → Analyze → error shows Vietnamese "API key Gemini không hợp lệ…" not raw stack
9. **Rate limit**: spam `/api/parse` from same IP → 429 after N requests
10. **Admin dashboard**: log in as a user in `ADMIN_USER_IDS` → visit `/admin/usage` → see per-user table + daily volume + CSV export link. Non-admin → 404.
11. **CSP**: DevTools Console → no `Refused to execute…` violations. Network response headers include `Content-Security-Policy` (or `Content-Security-Policy-Report-Only` if `CSP_REPORT_ONLY=1`).

## 7. Operational concerns

### Monitoring
- **Vercel logs**: dashboard → Logs. Filter `event:"llm_call"`, `event:"csp_violation"`, `[quota]`, `[ratelimit]`, `[byok-vault]`, `[alert-webhook]`.
- **Usage dashboard**: `/admin/usage` — per-user calls, tokens, USD cost; daily shared-key spend.
- **KV dashboard** (Upstash console): command count, hit rate. Free tier ≈ 30K commands/day.
- **Cost dashboards**: Google Cloud billing for Gemini, OpenAI usage page.

### Cost guardrails
- `ALERT_SHARED_DAILY_COST_USD` fires webhook when daily shared-key spend crosses threshold. Dedup once per UTC day per threshold.
- Provider-side billing alerts (Google Cloud, OpenAI dashboard).
- If shared-key abuse spikes: `DISABLE_SHARED_KEY=1` → redeploy → only BYOK users can analyze.

### Rollback
- Vercel Dashboard → Deployments → previous good deploy → ⋯ → **Promote to Production**. ~10s DNS swap.
- KV state survives rollback (decoupled from app version).
- For env var rotation (AUTH_SECRET): redeploy invalidates active BYOK vault tokens — users re-enter keys.

### SePay monetization (Phase 6)
- **Kill switch**: `MONETIZATION_ENABLED=0` → `/upgrade` redirects to `/job-fit`, checkout returns 503, webhook returns 503, everyone read as `free` regardless of `subscriptions` rows.
- **Webhook dashboard config** (SePay Dashboard → Webhooks):
  - URL: `https://<prod-domain>/api/webhooks/sepay`
  - Auth type: `Api_Key` — value must match `SEPAY_WEBHOOK_API_KEY` exactly
  - Event filter: `In_only`, account number = `SEPAY_ACCOUNT_NUMBER`
- **Idempotency**: `sepay_webhook_events.event_id` is PK; duplicate calls return `{success:true,duplicate:true}` and skip processing.
- **Always-200 contract**: any post-auth error is recorded in `sepay_webhook_events.error` and returns 200 — SePay must never retry on our internal failures.
- **Manual replay**: if `findOrderByTransaction` returns `no_match` (e.g. user forgot memo), inspect `sepay_webhook_events` payload and manually run `activateSubscription(userId, orderId)` via a script.
- **Order TTL**: pending orders >30 min are lazy-expired by the status route. No cron required.
- **Stack behavior on renewal**: paying while still in an active window extends `current_period_end` by +30d (no lost balance).

## 8. Known limits

- LinkedIn / Indeed direct scrape mostly fails (anti-bot) — paste JD instead.
- Scanned image PDFs return empty text (no OCR) — paste CV instead.
- BYOK vault TTL: 4 hours. After expiry user re-enters the key.
- Anonymous IP quota uses `x-forwarded-for` first IP; users behind same NAT share the quota.

## 9. Release checklist

- [ ] All required env vars set (Production scope)
- [ ] Vercel KV provisioned + connected
- [ ] Root Directory = `cv-ex-refactor` in Vercel Settings
- [ ] `next build` passes locally
- [ ] Smoke tests §6 pass on prod URL
- [ ] No `apiKey` in any response payload (DevTools verified)
- [ ] CSP enforce mode after staged report-only soak
- [ ] `ADMIN_USER_IDS` set so usage dashboard is reachable
- [ ] `ALERT_WEBHOOK_URL` + thresholds configured

## 10. Pilot vs Phase 2

| Path | Pilot (now) | Phase 2 |
|---|---|---|
| Sign-in UI | Hidden — anonymous shared-key works | Restore Sign-in button in `user-menu.tsx` |
| Shared-key quota | Per-IP, anonymous | Per-userId, signed-in |
| Google OAuth | Not configured | Required envs set, callback URI added |

## 11. Troubleshooting

### Git auto-deploy blocked with "X does not have a Vercel account linked to their GitHub account"

Vercel's **Git Author Trust** security feature blocks deploys triggered by commits whose author identity has no linked Vercel account. Common after first push from a new git user.

**Diagnose:**
```powershell
git log -1 --format="%an <%ae>"
vercel whoami
```

If the commit author's GitHub identity differs from the one your Vercel account is linked to → blocked.

**Fix options (pick one):**

1. **Link the offending GitHub account to Vercel** (cleanest if it's your account)
   - Open https://vercel.com/login in an incognito window
   - "Continue with GitHub" → sign in with the *offending* GitHub user (the name in the error)
   - Vercel auto-creates the account binding
   - Push triggers re-deploy automatically; or `vercel --prod` from CLI

2. **Change git author to a Vercel-linked identity**
   ```powershell
   git config user.email "<vercel-linked-email>"
   git config user.name "<vercel-linked-github-username>"
   git commit --amend --reset-author --no-edit
   git push --force-with-lease
   ```

3. **Deploy via CLI (bypass the Git webhook)** — works regardless of author trust
   ```powershell
   Set-Location C:\path\to\CVMatching   # repo root
   vercel --prod
   ```
   Uses your local CLI auth identity. Recommended for pilot until option 1 or 2 is in place.

4. **Disable Git Author Verification at the team level** (last resort)
   - Vercel Dashboard → Team → Settings → Security
   - Toggle off "Git Author Verification" (or similar). Removes the protection for everyone — only do this for solo pilots, never team production.

### Build error: "The provided path 'X/cv-ex-refactor/cv-ex-refactor' does not exist"

Root Directory in Vercel Settings + CLI cwd both point into `cv-ex-refactor/`. Two valid configs (pick one):

- **A (recommended)**: Vercel Root Directory = `cv-ex-refactor`, run `vercel link` and `vercel --prod` from **repo root**.
- **B**: Vercel Root Directory = empty/`./`, run `vercel link` and `vercel --prod` from **`cv-ex-refactor/`**. Note: Git auto-deploy then needs a `vercel.json` cd-fix or will break — A is safer.

### CSP violation breaks page after deploy

If something stops working post-CSP-enforce:
1. Open DevTools Console → look for `Refused to ... CSP directive`.
2. Note the blocked URL + directive name.
3. Either whitelist in `src/proxy.ts` `buildCsp()`, or set `CSP_REPORT_ONLY=1` env to soften enforcement temporarily.
4. Redeploy.

### Quota / KV writes silently no-op

Check `KV_REST_API_URL` + `KV_REST_API_TOKEN` are set on the deployed environment (not just Preview). The quota/usage/vault layers all fail-open when KV is missing — analytics + protection disappear silently.

---

## 12. Job Fit & Study — v0.3 Phase 4 runbook

### Cron refresh (`GET /api/jobs/refresh`)

| Setting | Value |
|---|---|
| Schedule | `0 20 * * *` (20:00 UTC = 03:00 ICT, daily) |
| Vercel tier required | **Pro** (`maxDuration = 300s`) |
| Max batch | ~150 jobs × 2s = ~5 min; 30s deadline buffer baked in |
| Cursor resume | `refresh:cursor` KV key; auto-wraps to 0 when all jobs processed |
| Pool-low alert | Fires `ALERT_WEBHOOK_URL` when active pool < 50 after tick |

**Outbound crawl constraints:**

| Rule | Value |
|---|---|
| User-Agent | `ResumeRefineRefreshBot/1.0` |
| Delay between requests | 1500 ms ± 500 ms jitter |
| Hard deadline break | 270 s elapsed (30 s buffer under 300 s `maxDuration`) |
| Auto-expire | Jobs with `verifiedAt > 21d` moved to `jobs:expired` every tick |

**If downgraded to Hobby tier (maxDuration = 60s):** reduce to ~25 jobs/tick, add 5 schedules/day, adjust `SLEEP_MS` to 2000 in `refresh/route.ts`.

### Environment variable: `CRON_SECRET`

Vercel Pro **auto-injects** `CRON_SECRET` as `Authorization: Bearer <secret>` on every cron invocation. No manual setup required in Vercel Dashboard for Pro projects.

For local smoke testing, add to `.env.local` (gitignored):
```
CRON_SECRET=your-local-test-secret-min-16-chars
```

Install the `@vercel/config` devDep (already in `package.json` after Phase 4):
```powershell
pnpm add -D @vercel/config
```

The `vercel.ts` TypeScript config at `cv-ex-refactor/vercel.ts` defines the cron schedule. Type-check with:
```powershell
npx tsc --noEmit
```

### Kill-switch reset runbook

If the cost guard sets `kill-switch:job-recommend` (fires at $3/day cumulative):

```bash
# Upstash console → CLI tab, or via kv-client in a one-off script:
DEL kill-switch:job-recommend
```

The flag auto-expires in 24h. Fix the root cause (abuse loop, runaway model calls) before clearing — cost will re-trigger it if spend stays above $3/day.

### Refresh cursor reset

If cursor gets stuck or you want a full re-scan from job index position 0:

```bash
DEL refresh:cursor
```

Next cron tick starts from the beginning of `jobs:active`.

### Ingest CLI runbook

```powershell
# From cv-ex-refactor/
pnpm ingest                          # paste mode (interactive)
pnpm ingest -- --file data/seed-jobs.json   # file mode
pnpm ingest -- --stats               # show current pool stats
pnpm ingest -- --expire <jobId>      # manual expire
pnpm ingest -- --rebuild-embeddings  # re-embed all active jobs (slow, costs Gemini tokens)
```

### Admin dashboard: Job Fit section

`/admin/usage` now shows a "Job Fit & Study" section with:
- Today's recommend cost + refresh stats
- Top-10 clicked jobs (by jobId)
- Top-disliked study topics (weekly)

Data is read from KV keys: `metrics:cost:<YMD>:job-recommend`, `metrics:click:*:<YMD>`, `metrics:refresh:<YMD>`, `dislikes:*:<weekYMD>`.

---

## 13. KV key inventory — complete namespace

**Job storage:**
- `job:<jobId>` → full job record (title, company, vertical, embedding, verifiedAt, etc.). TTL: 21d.
- `jobs:active` → set of active job IDs (auto-refresh cursor scans). TTL: none.
- `jobs:expired` → set of expired/removed job IDs (archive). TTL: none.

**Embeddings (corpus):**
- `embeddings:active:v<n>` → chunked packed Float32Array blob (250 jobs/chunk). Module memory cached. TTL: none.
- `embed-cache:<hmac>` → CV embedding cache. HMAC-SHA256(cvText, EMBED_CACHE_SECRET). TTL: 6h.

**Metrics:**
- `metrics:cost:<YMD>:<bucket>` → daily cumulative spend per bucket (USD string). Buckets: `analyze`, `rewrite`, `career-path`, `job-recommend`. TTL: 2d.
- `metrics:click:<jobId>:<YMD>` → click count on job redirect. TTL: 2d.
- `metrics:click:total:<YMD>` → total clicks all jobs today. TTL: 2d.
- `metrics:refresh:<YMD>` → cron tick stats (ok, expired, errors). TTL: 2d.

**Rate limit & quota:**
- `quota:<bucketName>:<identifier>:<resetHour>` → consumed quota count (analyzed by `src/lib/quota/gate.ts`). TTL: per bucket (1d typical).

**Feedback & dislike tracking:**
- `dislikes:<topicId>:<weekYMD>` → counter for dislike event this week. TTL: 60d.
- `topic-feedback:<topicId>` → list (max 1000) of {jobId, action, timestamp}. TTL: none — bounded by `ltrim(0, 999)`.

**Admin / operational:**
- `refresh:cursor` → 0-indexed position in jobs:active for resumable cron batch. TTL: none.
- `kill-switch:<bucket>` → "true" flag if cost guard triggered; blocks endpoint. TTL: 24h.
- (v0.1–v0.2) `visits:<YMD>` → visit count (total + per-IP dedup). TTL: none.

**Search & filtering (future expansion):**
Reserved for v0.4+ if full-text or faceted search added.

---

## 14. Quota bucket table — all versions

Source of truth: `src/lib/quota/consume-quota.ts` (`QUOTA_LIMITS`,
`ANON_QUOTA_LIMITS`). Update this table whenever those constants change.

| Bucket | Anon | Signed-in | BYOK | Notes |
|---|---|---|---|---|
| `analyze` | 3/day | 5/day | unlimited | v0.4 CV-Solo 2-stage analyze |
| `generate-cv` | 1/day | 2/day | unlimited | Polished CV (v3 CV-Solo prompt) |
| `generate-cover-letter` | 0/day | 3/day | unlimited | Anon blocked by design (pilot decision) |
| `career-path` | 2/day | 3/day | unlimited | Career roadmap (v0.2+) |
| `job-recommend` | 5/day | 12/day | unlimited | Job-fit recommendations (v0.3+, admin-only currently) |
| `extract-must-haves` | passthrough | passthrough | passthrough | IP rate-limited, no quota debit |
| `career-path-suggest` | passthrough | passthrough | passthrough | IP rate-limited, no quota debit |
| `company-enrich` | passthrough | passthrough | passthrough | Lazy on-demand company card LLM enrichment (v0.4 Phase A); cost-only kill-switch + IP rate-limit |

---

## 15. Rollback procedure per phase

| Phase | Status | Rollback target |
|---|---|---|
| P0 (Hardening) | ✓ shipped | n/a (base foundation) |
| P1 (Ingest + seed) | ✓ shipped | commit `2b4692a` (before P2 recommend endpoint) |
| P2 (Recommend endpoint) | ✓ shipped | commit `e16e802` (before P3 UI) |
| P3 (UI job-fit pages) | ✓ shipped | commit `fe97bd5` (before P4 cron/redirect) |
| P4 (Cron + redirect + feedback) | ✓ shipped | commit `aaf7470` (before P5 docs) |
| P5 (Tests + docs + deploy) | in progress | current main branch (final ship target) |

**Rollback procedure:**
1. Vercel Dashboard → Deployments → select previous good commit.
2. Click ⋯ → **Promote to Production**.
3. KV state persists (decoupled from app version).
4. If env vars changed (e.g., `EMBED_CACHE_SECRET` rotated): redeploy to invalidate old cache entries.

---

## 16. Smoke checklist after deploy

1. Homepage `/` renders; "Match your profile…" visible
2. CV Analyze works (shared-key anon path): paste sample CV+JD → result in <10s
3. `/admin/usage` accessible (verify `ADMIN_USER_IDS` set)
4. **v0.3 new:** `/job-fit` page loads (empty state: "paste CV")
5. **v0.3 new:** `/api/jobs/refresh` responds with Bearer auth, cron schedule live (`vercel.ts` type-checks)
6. Verify cost guard: `metrics:cost:<today>:job-recommend` exists in KV
7. KV pool stats: `jobs:active` has entries; `embeddings:active:v<n>` blob exists

---

## 17. Pilot lockdown runbook (post v0.3 ship, 2026-06-02)

After ship date, the site is locked down to control free-tier Gemini cost
while admin completes usage analysis on the ultra-tier API key. Lockdown
state is enforced by three orthogonal switches; admins bypass all three.

### Current lockdown state (as of 2026-06-04 EOD, post v0.4 ship)

| Switch | State | Storage | Effect on non-admin |
|---|---|---|---|
| `DISABLE_SHARED_KEY=1` | ON | Vercel env | All non-BYOK requests → 503 `shared_key_disabled` at `resolveApiKey` |
| `kill-switch:*` (8 buckets) | ON | KV `kill-switch:<bucket>` = `'1'` | Per-action 503 `service_unavailable` at route handler |
| `login:enabled` | OFF | KV `login:enabled` deleted | `/sign-in` returns 404; topnav login button hidden |

Authoritative bucket list in `src/lib/cost/buckets.ts` (8 buckets):
`analyze`, `generate-cv`, `generate-cover-letter`, `career-path`,
`career-path-suggest`, `extract-must-haves`, `job-recommend`,
`company-enrich`.

Admin (`auto.agent.solution@gmail.com` per `ADMIN_USER_EMAILS`) bypasses all
three: resolves via `resolveApiKey` returning `isAdmin: true`; routes skip
`checkKillSwitch` when `resolved.byok || resolved.isAdmin`; `/sign-in` page
treats admin sessions as authed and redirects to `/`.

### Re-enable procedure (when usage analysis complete)

**Step 1 — Enable public login first** (gives users an entry point):

```powershell
cd cv-ex-refactor
pnpm run login-flag on
# Or: admin UI → /admin/maintenance → "Site Controls" → Public login toggle
```

**Step 2 — Lift the kill-switches**:

```powershell
pnpm run kill-switch off --all
pnpm run kill-switch status   # verify all eight show off
```

**Step 3 — Lift the env-level shared-key block**:

Vercel Dashboard → Project → Settings → Environment Variables → delete (or
blank) `DISABLE_SHARED_KEY` → **Redeploy** (env change does not propagate
without redeploy). Confirm:

```powershell
vercel env ls production | findstr DISABLE_SHARED_KEY
# Expected: no row, or row with empty value
```

**Step 4 — Smoke** (walks the full v0.4 CV-Solo chain end-to-end):

0. **Pre-flight (run BEFORE lifting any switch):** verify cost-alert webhook
   reaches your device end-to-end. If `ALERT_WEBHOOK_URL` is marked
   "Sensitive" in Vercel (recommended), `vercel env pull` will mask the
   value — feed it via stdin instead:

   ```powershell
   cd cv-ex-refactor
   $secure = Read-Host "Paste Pushover URL" -AsSecureString
   $env:ALERT_WEBHOOK_URL = [System.Net.NetworkCredential]::new('', $secure).Password
   pnpm tsx scripts/test-cost-alert.ts
   $env:ALERT_WEBHOOK_URL = $null; Remove-Variable secure
   ```

   Expect `OK [Pushover] 200` + one push within ~5s. Fails here mean prod
   cost-kill events will silently no-op — DO NOT proceed to Step 1 reopen.

1. Open private/incognito browser → `https://resume-refactor.vercel.app`
2. Click **"Đăng nhập với Google"** in topnav → complete OAuth
3. `/analyze`: paste CV-only (no JD field exists in v0.4) → Analyze → 9 sliders
   render in ~10s. Sliders show LLM CV-intrinsic scores for inferred role; the
   `ReAnalyzeBanner` may appear once if the account has stale `v1` cache —
   click it to refresh into `cv-ex-analysis-v2`.
4. Click **"Tạo CV refined"** → `/refined-cv` polished markdown opens (~5-15s).
   Confirms `refined-cv-text:v1` write side-effect.
5. Click **"Tìm 10 job phù hợp →"** → `/job-fit` ranks against the refined CV.
   Open any tier S/A/B detail → confirm Cover Letter shortcut CTA renders.
6. Click **"Tạo Cover Letter"** on a job detail → auto-scrolls to
   CoverLetterBlock + streams output. Burns 1 `generate-cover-letter` quota.
7. `/career-path`: confirm single Card with **one** primary CTA (no auto-fire
   on mount per `feedback_no_auto_llm_calls`). Click it once → suggestion loads.
8. Verify `/api/whoami` (logged-in): `{ admin: { isAdmin: false }, authed: true }`.
9. Monitor `/admin/usage` over next 2-4 hours — confirm daily spend stays
   well below `ALERT_SHARED_DAILY_COST_USD` (default $2.50) and that
   `extract-must-haves` / `career-path-suggest` rate-limiters are not
   tripping under real traffic.

### Quotas in effect once shared key is re-enabled

Per `src/lib/quota/consume-quota.ts`. Anonymous shared-key path was removed
2026-06-02; only signed-in users hit the shared key. Anon column reflects
`ANON_QUOTA_LIMITS` — applied only if the anon path is ever reopened.

| Action | Logged-in cap/day | Anon cap/day | Notes |
|---|---|---|---|
| `analyze` | 5 | 3 | v0.4 CV-Solo 2-stage call |
| `generate-cv` | 2 | 1 | Polished CV (v3 prompt) |
| `generate-cover-letter` | 3 | 0 | Anon blocked by design |
| `career-path` | 3 | 2 | Roadmap |
| `job-recommend` | 12 | 5 | Admin-only currently |
| `extract-must-haves` | unlimited (passthrough) | — | IP-rate-limited separately |
| `career-path-suggest` | unlimited (passthrough) | — | IP-rate-limited separately |

Reset 00:00 ICT (Vietnam midnight). BYOK users skip quotas entirely.

### Post-reopen tunables to observe

| Setting | Default | Tune when |
|---|---|---|
| `ROLE_INFER_CONFIDENCE_THRESHOLD` (Vercel env, optional) | `0.75` | Confirm-modal fires too often (>30% of analyzes) → lower to `0.65`; if it rarely fires but mis-classifications appear → raise to `0.85` |
| `ALERT_SHARED_DAILY_COST_USD` | `2.50` | Real traffic shows sustained spend pattern — tighten or loosen accordingly |
| `ALERT_WEBHOOK_URL` (Pushover/CallMeBot) | unset | **Set before reopen** — without it, cost-kill events log silently to console |

### Roll back fast (if cost spike detected)

Reverse Step 3 (most aggressive) → Step 2 → Step 1:

```powershell
# Quickest: bring back the kill-switches without redeploy
pnpm run kill-switch on --all

# If users already mid-session, also close login:
pnpm run login-flag off

# If KV unavailable / can't run CLI: set DISABLE_SHARED_KEY=1 on Vercel + redeploy
```

Admin bypass keeps the admin dashboard reachable during rollback. Existing
non-admin sessions hit 503 on next LLM call; their UI shows a friendly
error toast (per fix in commit `4636ce8`).

### Operator CLI reference

All three controls have CLI wrappers and read `.env.local` for KV creds:

| Command | Purpose |
|---|---|
| `pnpm run login-flag status | on | off` | Toggle public login |
| `pnpm run kill-switch status | on <bucket> | off <bucket> | on --all | off --all` | Toggle per-bucket cost kill-switch |
| `pnpm run maintenance status | on | off` | Toggle site-wide maintenance (returns 503 + HTML on every page nav) |

The maintenance toggle is the heaviest — use only for true outages, not
budget control.

---

## 18. Job pool — admin UI + GitHub Actions dispatch

Shipped 2026-06-07. Lets the admin watch pool state + trigger a refresh
without opening a terminal.

### Routes

- `/admin/pool` — read-only stats page (active count, vertical/source/seniority
  breakdown, freshness percentiles, 10 most-recent verified jobs, last UI
  dispatch timestamp).
- `POST /api/admin/pool/trigger` — auth-gated dispatch endpoint. Calls
  GitHub REST `POST /repos/{repo}/actions/workflows/refresh-jobs.yml/dispatches`
  with a Fine-grained PAT. Returns 204-equivalent + `runsUrl`.

### One-time PAT setup

1. **Create the PAT** at https://github.com/settings/personal-access-tokens/new
   - Token name: `cvmatching-dispatch`
   - Expiration: 1 year (max for fine-grained)
   - Repository access: **Only select repositories** → pick `cvmatching`
   - Permissions → Repository permissions → **Actions: Read and write**
   - No account/org permissions needed.
2. **Set on Vercel** as a Sensitive env var named `GITHUB_DISPATCH_TOKEN`:
   ```powershell
   vercel env add GITHUB_DISPATCH_TOKEN production
   # paste the PAT when prompted; mark as Sensitive
   ```
3. Optional: set `GITHUB_REPO` if the repo slug differs from the default
   `autoagentsolution-boop/cvmatching`.
4. Redeploy (Vercel does this automatically on env change).
5. Verify: open `/admin/pool` → "Refresh now" button should be enabled
   (not the "Chưa setup" warning).

### What the token CAN'T do

- Read code (token has no `contents` scope).
- Modify workflows (no `workflows` scope — only Actions runtime).
- Touch other repos in the org.
- Issue tokens for further GitHub calls.

If the PAT leaks, blast radius = an attacker can dispatch the workflow
repeatedly. Revoke at https://github.com/settings/personal-access-tokens
and rotate.

### Security guarantees in the endpoint

- Admin auth via `isAdminUser(session?.user)` — same gate as the rest of
  `/admin/*`.
- PAT NEVER appears in response bodies (only `runsUrl` is returned).
- GitHub error responses are truncated to 200 chars + `Bearer \S+` masked
  before being echoed in the error JSON (defense-in-depth for the case
  GitHub ever reflects the auth header in their error body).
- KV write of "last dispatch" stamp uses non-sensitive fields only (timestamp,
  user email).

### Key rotation matrix

Shared keys (used by Vercel runtime + local CLI + GH Actions runner):

| Key | `.env.local` (operator) | Vercel env | GH Actions secret |
|---|---|---|---|
| `GEMINI_API_KEY` | ✓ | ✓ | ✓ |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | ✓ | ✓ | ✓ |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | ✓ | ✓ | ✓ |
| `EMBED_CACHE_SECRET` | (optional) | ✓ | (optional) |
| `ALERT_WEBHOOK_URL` | (optional) | ✓ | (optional) |

Single-host keys:

| Key | Where only |
|---|---|
| `GITHUB_DISPATCH_TOKEN` | Vercel env only |
| `CRON_SECRET` | Vercel env only (auto-injected by Vercel cron) |
| `AUTH_SECRET` / `GOOGLE_CLIENT_*` / `SEPAY_*` | Vercel env only |

Rotation procedure (for any shared key, e.g. when Gemini key is suspect):

```powershell
# 1. Get new value from upstream (Gemini console / Neon dashboard / Upstash console)
$NEW = "ya29.new-token-here"

# 2. Update Vercel (production)
vercel env rm GEMINI_API_KEY production  # if it was Sensitive type, NOT recoverable
vercel env add GEMINI_API_KEY production
# paste $NEW

# 3. Update GH Actions
echo $NEW | gh secret set GEMINI_API_KEY

# 4. Update local
# Open .env.local in editor, replace the GEMINI_API_KEY= line

# 5. Verify
pnpm run ingest stats  # local — should not error on Gemini
# Trigger workflow once from admin UI — should succeed
```

**Caveat from memory `feedback_vercel_sensitive_env_pull_masked`:** `vercel env pull` returns Sensitive values as empty strings. After rotation, NEVER rely on `vercel env pull` to populate `.env.local` for sensitive keys — paste manually from the source.

### Manual fallback if the trigger endpoint is down

The same workflow can be dispatched without going through Vercel:

```powershell
gh workflow run refresh-jobs.yml                            # default sweep
gh workflow run refresh-jobs.yml -f pages=2 -f max_age_days=5
```

And of course `pnpm run seed-pool` locally still works for everything.

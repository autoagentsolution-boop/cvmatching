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

| Variable | Notes |
|---|---|
| `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Also derives the BYOK vault encryption key. |
| `GEMINI_API_KEY` | Shared-key path. **Production scope only.** |
| `OPENAI_API_KEY` | Optional; same rule. |
| `KV_REST_API_URL` | Auto-injected. |
| `KV_REST_API_TOKEN` | Auto-injected. |

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

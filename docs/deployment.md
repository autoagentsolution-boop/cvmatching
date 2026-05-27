# Deployment Guide — Vercel

Production deploy of ResumeRefine (the Next.js app under `cv-ex-refactor/`).

## Prerequisites

- Vercel account + CLI installed (`pnpm dlx vercel --version`)
- Google Cloud project with OAuth 2.0 Client ID (for sign-in)
- Gemini and/or OpenAI API key (shared-key path)
- Vercel KV (Upstash Redis) provisioned (for quota + rate limit)

## 1. Link the repo to Vercel

```bash
cd cv-ex-refactor
pnpm dlx vercel link
# Select scope, link to existing project or create new
```

Framework preset: **Next.js**. Root directory: `cv-ex-refactor` (if repo root contains other folders).

## 2. Provision Vercel KV

1. Vercel Dashboard → your project → **Storage** tab
2. **Create** → **KV** → name it (e.g. `resume-refine-kv`) → **Create**
3. **Connect** to project → all environments

This auto-injects `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN` into project env vars.

Pull them locally:
```bash
pnpm dlx vercel env pull .env.local
```

## 3. Configure environment variables

Vercel Dashboard → **Settings** → **Environment Variables**. Add (scope **Production**):

| Variable | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | If using Gemini shared key | Production scope only — keep out of Preview |
| `OPENAI_API_KEY` | If using OpenAI shared key | Production scope only |
| `AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Yes | From Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Yes | From Cloud Console |
| `KV_REST_API_URL` | Yes | Auto-injected by KV connect |
| `KV_REST_API_TOKEN` | Yes | Auto-injected by KV connect |
| `DISABLE_SHARED_KEY` | No | Emergency kill switch — set `1` to force BYOK only |

**Shared keys MUST be Production scope only.** Preview deploys (PRs) should not have them — forces BYOK testing and prevents PR-preview key leaks.

## 4. Configure Google OAuth callback

Cloud Console → **Credentials** → your OAuth 2.0 Client → **Authorized redirect URIs**:

```
https://<your-vercel-domain>/api/auth/callback/google
```

Common forms: `https://your-project.vercel.app/api/auth/callback/google`, plus any custom domain.

## 5. First deploy

```bash
pnpm dlx vercel --prod
```

Or push to `main` if Git integration is set up.

## 6. Smoke test (run after every deploy)

1. **Homepage** — visit `/` → renders without errors
2. **Sign in** — click sign in → Google consent → redirect to `/` authed
3. **BYOK Gemini** — open Settings → tick BYOK → paste a real Gemini key → tick "Remember key" → Save
4. **Parse** — upload a PDF CV → text appears in CV textarea
5. **Scrape** — paste a public job URL → JD text fills in
6. **Must-haves** — auto-extracts after JD ≥ 80 chars → 5-12 items
7. **Analyze** — click "Analyze & Score" → result appears within ~10s → 9 sliders show LLM scores
8. **Slider drag** — overall score + decision badge update without LLM call
9. **Generate CV** — click "Generate refined CV" → markdown view opens
10. **Quota badge** — visible in topnav with `0/5 analyses · 0/2 rewrites` (or higher after step 7-9). Only if signed in.
11. **DevTools Network** — inspect `/api/analyze` response: `apiKey` MUST NOT appear anywhere in the response body or headers
12. **Rate limit** — `for i in {1..40}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST -F "wrong=1" https://<domain>/api/parse; done` → expect mix of 400 and 429 after request 30

## 7. Operational concerns

### Monitoring
- **Vercel logs**: dashboard → Deployments → latest → Logs. Filter `[quota]` `[ratelimit]` `parse_failed`.
- **KV dashboard**: command count, hit rate. Free tier = 30K commands/day. ≈ 15K analyses/day headroom.
- **OAuth**: Cloud Console → Credentials → usage chart.

### Cost guardrails
- Google Cloud billing alert on Gemini API usage
- OpenAI usage limit in OpenAI dashboard
- If shared-key abuse spikes (KV daily commands > 20K): set `DISABLE_SHARED_KEY=1`, redeploy. BYOK still works.

### Rollback
- Vercel Dashboard → Deployments → previous prod deploy → **Promote to Production**
- KV state survives rollback (decoupled from app version)

## 8. Known limits (Phase 1)

- LinkedIn / Indeed direct scrape mostly fails (anti-bot) — paste JD instead
- Scanned image PDFs return empty text (no OCR) — paste CV instead
- Single-locale UI (English labels + Vietnamese errors). Full VN/EN toggle = Phase 1.1.
- No analysis history persistence — refresh loses state.

## 9. Phase 1 release checklist

- [ ] All env vars set (Production scope)
- [ ] Google OAuth callback URL added
- [ ] Vercel KV provisioned + connected
- [ ] `pnpm build` succeeds locally
- [ ] Smoke test 12 scenarios above pass on prod URL
- [ ] DevTools Network: no `apiKey` in any response payload
- [ ] Git tag `v0.1.0` pushed

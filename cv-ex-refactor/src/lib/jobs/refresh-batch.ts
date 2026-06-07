// Pure batch-refresh helper — testable with mocked fetch + repo.
// Fetches HEAD (falls back to GET on 405) for each job's sourceUrl.
// Classifies response: 404/410 → expire, expired-body pattern → expire, 200 → touchVerifiedAt.
//
// Postgres-backed since pre-2K hardening (2026-06-07). Previously read from
// KV repo — would have missed every job ingested into PG after Phase 4 cutover.

import { getJob, expireJob, touchVerifiedAt } from './repo-postgres';

// Matches common Vietnamese + English "job closed" patterns in page body.
const EXPIRED_BODY_RE =
  /(job|tin tuy[eê]n d[uụ]ng|v[iị] tr[iý]).{0,80}(h[eê]t h[aạ]n|[dđ][aã]\s*[dđ][oó]ng|expired|closed)/i;

export interface RefreshBatchOpts {
  ua: string;
  timeoutMs: number;
  sleepMs: number;
  jitterMs: number;
  deadlineMs: number; // absolute epoch ms — break loop when Date.now() exceeds this
}

export interface RefreshBatchResult {
  ok: number;
  expired: number;
  errors: number;
  lastIndex: number; // index of last processed item; -1 if nothing processed
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function headWithFallback(
  url: string,
  opts: { ua: string; timeoutMs: number },
): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': opts.ua },
      signal: controller.signal,
      redirect: 'follow',
    });
    // Some servers reject HEAD — retry with GET
    if (res.status === 405) {
      clearTimeout(tid);
      const ctrl2 = new AbortController();
      const tid2 = setTimeout(() => ctrl2.abort(), opts.timeoutMs);
      try {
        return await fetch(url, {
          method: 'GET',
          headers: { 'User-Agent': opts.ua },
          signal: ctrl2.signal,
          redirect: 'follow',
        });
      } finally {
        clearTimeout(tid2);
      }
    }
    return res;
  } finally {
    clearTimeout(tid);
  }
}

async function isBodyExpired(res: Response): Promise<boolean> {
  try {
    // Only sniff first 4 KB to keep it cheap
    const text = await res.clone().text();
    return EXPIRED_BODY_RE.test(text.slice(0, 4096));
  } catch {
    return false;
  }
}

export async function refreshBatch(
  ids: string[],
  opts: RefreshBatchOpts,
): Promise<RefreshBatchResult> {
  let ok = 0;
  let expired = 0;
  let errors = 0;
  let lastIndex = -1;

  for (let i = 0; i < ids.length; i++) {
    // Deadline guard — break early so caller can save cursor and resume next tick
    if (Date.now() >= opts.deadlineMs) break;

    const id = ids[i] as string;
    lastIndex = i;

    try {
      const job = await getJob(id);
      if (!job) {
        // Job disappeared from KV between listActiveIds and here — skip silently
        errors++;
      } else {
        // P1.1 (defense-in-depth) — refuse to HEAD non-http(s) schemes
        let targetUrl: URL;
        try { targetUrl = new URL(job.sourceUrl); } catch { errors++; continue; }
        if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') {
          console.warn('[refresh-batch] non-http(s) sourceUrl skipped', { id, protocol: targetUrl.protocol });
          errors++;
          continue;
        }

        const res = await headWithFallback(job.sourceUrl, {
          ua: opts.ua,
          timeoutMs: opts.timeoutMs,
        });

        if (res.status === 404 || res.status === 410) {
          await expireJob(id);
          expired++;
        } else if (res.status >= 200 && res.status < 300) {
          const bodyExpired = await isBodyExpired(res);
          if (bodyExpired) {
            await expireJob(id);
            expired++;
          } else {
            await touchVerifiedAt(id, new Date().toISOString());
            ok++;
          }
        } else {
          // 5xx, 3xx loops, etc. — count as error but don't expire
          errors++;
        }
      }
    } catch {
      // Network timeout, DNS failure, etc.
      errors++;
    }

    // Polite crawl delay: sleepMs ± jitterMs
    if (i < ids.length - 1 && Date.now() < opts.deadlineMs) {
      const jitter = Math.floor(Math.random() * opts.jitterMs * 2) - opts.jitterMs;
      await sleep(opts.sleepMs + jitter);
    }
  }

  return { ok, expired, errors, lastIndex };
}

// System-curl shell-out for ingest scripts.
// Why: ITviec (and likely TopCV/VNW) Cloudflare-fingerprint Node's undici TLS
// signature → 403 even with full browser User-Agent + sec-ch-ua headers.
// System curl negotiates a Chrome-like TLS handshake that passes the check.
//
// Used by ingest-urls.ts (detail page fetch) and ingest-itviec.ts (listing
// fetch). Both scripts can call this without holding shape opinions about
// the response — caller does the parsing.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

const MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15000;

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export interface CurlOptions {
  ua?: string;
  acceptLanguage?: string;
  timeoutMs?: number;
}

export interface CurlResult {
  status: number;
  body: string;
}

/**
 * Fetch a URL via system curl and return status + body. Never throws on
 * HTTP non-2xx — caller decides how to handle status. Throws only on
 * subprocess failure (curl missing, timeout, network unreachable).
 *
 * `--write-out` appends the status code on a dedicated last line so we can
 * separate it from the body without spawning a second process.
 */
export async function fetchViaCurl(url: string, opts: CurlOptions = {}): Promise<CurlResult> {
  const ua = opts.ua ?? DEFAULT_UA;
  const acceptLanguage = opts.acceptLanguage ?? 'vi-VN,vi;q=0.9,en;q=0.8';
  const timeoutSec = Math.ceil((opts.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000);

  const args = [
    '-sSL',
    '--max-time', String(timeoutSec),
    '-A', ua,
    '-H', `Accept-Language: ${acceptLanguage}`,
    '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    '-H', 'Accept-Encoding: gzip, deflate, br',
    '--compressed',
    '--write-out', '\n__CURL_STATUS__:%{http_code}',
    url,
  ];

  const { stdout } = await execFileP('curl', args, {
    maxBuffer: MAX_BUFFER_BYTES,
    windowsHide: true,
  });

  const marker = '\n__CURL_STATUS__:';
  const idx = stdout.lastIndexOf(marker);
  if (idx < 0) {
    return { status: 0, body: stdout };
  }
  const status = parseInt(stdout.slice(idx + marker.length).trim(), 10) || 0;
  const body = stdout.slice(0, idx);
  return { status, body };
}

/**
 * Verify curl is on PATH. Call once at script start so we fail fast with a
 * clear error instead of a subprocess ENOENT mid-loop.
 */
export async function assertCurlAvailable(): Promise<void> {
  try {
    await execFileP('curl', ['--version'], { windowsHide: true });
  } catch {
    throw new Error(
      'system `curl` not found on PATH. Install curl (Windows 10+ ships it by default; on Linux: apt install curl).',
    );
  }
}

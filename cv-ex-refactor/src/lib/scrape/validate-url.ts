import { promises as dns } from 'node:dns';

export type UrlValidationResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

const PRIVATE_IPV4 = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./,
];

const PRIVATE_IPV6 = [/^::1$/, /^fc[0-9a-f]{2}:/i, /^fd[0-9a-f]{2}:/i, /^fe[89ab][0-9a-f]:/i];

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', 'ip6-localhost', 'ip6-loopback']);

export async function validateUrl(input: string): Promise<UrlValidationResult> {
  if (typeof input !== 'string' || input.length === 0) {
    return { ok: false, reason: 'URL trống' };
  }
  if (input.length > 2048) {
    return { ok: false, reason: 'URL quá dài' };
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: 'URL không hợp lệ' };
  }

  const isDev = process.env.NODE_ENV === 'development';
  if (url.protocol !== 'https:' && !(isDev && url.protocol === 'http:')) {
    return { ok: false, reason: 'Chỉ chấp nhận HTTPS' };
  }

  const host = url.hostname.toLowerCase();
  if (!host) return { ok: false, reason: 'Hostname trống' };
  if (BLOCKED_HOSTNAMES.has(host)) return { ok: false, reason: 'Hostname bị chặn' };
  if (host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, reason: 'Hostname nội bộ bị chặn' };
  }

  try {
    const addresses = await dns.lookup(host, { all: true });
    for (const addr of addresses) {
      if (isPrivateAddress(addr.address)) {
        return { ok: false, reason: 'IP private bị chặn (SSRF)' };
      }
    }
  } catch {
    return { ok: false, reason: 'Không phân giải được DNS' };
  }

  return { ok: true, url };
}

function isPrivateAddress(addr: string): boolean {
  if (addr.includes(':')) {
    return PRIVATE_IPV6.some((rx) => rx.test(addr));
  }
  return PRIVATE_IPV4.some((rx) => rx.test(addr));
}

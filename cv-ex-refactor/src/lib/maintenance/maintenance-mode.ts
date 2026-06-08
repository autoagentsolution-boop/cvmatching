import { kv, kvAvailable } from '@/lib/quota/kv-client';

export const MAINTENANCE_KEY = 'maintenance:mode';

const CACHE_TTL_MS = 5_000;
let cached: { value: boolean; expiresAt: number } | null = null;

/**
 * Returns true when the maintenance flag is set in KV. Result is memoised for
 * 5s per process so the KV round-trip does not run on every request.
 *
 * Fail-open: any error reading KV returns false (assume site is up) so a KV
 * outage does not also take the public site offline.
 */
export async function isMaintenanceMode(): Promise<boolean> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  if (!kvAvailable) {
    cached = { value: false, expiresAt: now + CACHE_TTL_MS };
    return false;
  }
  try {
    const raw = await kv.get<unknown>(MAINTENANCE_KEY);
    const on = raw === '1' || raw === 1;
    cached = { value: on, expiresAt: now + CACHE_TTL_MS };
    return on;
  } catch {
    cached = { value: false, expiresAt: now + CACHE_TTL_MS };
    return false;
  }
}

export function resetMaintenanceCache(): void {
  cached = null;
}

export function maintenanceHtml(): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bảo trì hệ thống — Resume Refactor</title>
<meta name="robots" content="noindex">
<style>
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #faf7f4; color: #1f1d1b; padding: 24px; }
@media (prefers-color-scheme: dark) { body { background: #1c1b1a; color: #ece7e2; } }
.card { max-width: 480px; text-align: center; }
.icon { font-size: 56px; line-height: 1; margin-bottom: 16px; }
h1 { font-size: 24px; font-weight: 700; margin: 0 0 12px; }
p { font-size: 16px; line-height: 1.5; margin: 8px 0; opacity: 0.8; }
.eta { font-size: 14px; opacity: 0.6; margin-top: 24px; }
.admin { display: inline-block; margin-top: 20px; padding: 8px 14px; font-size: 13px; color: inherit; text-decoration: none; border: 1px solid currentColor; border-radius: 8px; opacity: 0.4; transition: opacity 0.15s; }
.admin:hover { opacity: 0.85; }
</style>
</head>
<body>
<div class="card">
<div class="icon">🛠️</div>
<h1>Đang bảo trì</h1>
<p>Hệ thống tạm thời ngưng phục vụ để nâng cấp tính năng và cập nhật dữ liệu job.</p>
<p>Vui lòng quay lại sau ít phút.</p>
<p class="eta">Cập nhật mới nhất: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC</p>
<a class="admin" href="/sign-in" rel="nofollow">Admin sign-in →</a>
</div>
</body>
</html>`;
}

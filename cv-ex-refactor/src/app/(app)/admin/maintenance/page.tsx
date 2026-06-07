import type { Metadata } from 'next';
import { kv, kvAvailable } from '@/lib/quota/kv-client';
import { MAINTENANCE_KEY } from '@/lib/maintenance/maintenance-mode';
import { LOGIN_FLAG_KEY } from '@/lib/maintenance/login-flag';
import { MaintenanceToggle } from './maintenance-toggle';
import { LoginFlagToggle } from './login-flag-toggle';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Pin to Singapore — KV (Upstash) is in sg-east; default Vercel region
// US-East adds ~250ms per KV read.
export const preferredRegion = 'sin1';

export const metadata: Metadata = {
  title: 'Site Controls — Admin',
  robots: { index: false, follow: false },
};

async function readFlag(key: string): Promise<boolean> {
  if (!kvAvailable) return false;
  try {
    const raw = await kv.get<unknown>(key);
    return raw === '1' || raw === 1;
  } catch {
    return false;
  }
}

export default async function AdminMaintenancePage() {
  const maintenanceOn = await readFlag(MAINTENANCE_KEY);
  const loginOn = await readFlag(LOGIN_FLAG_KEY);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-display-sm font-bold text-primary">Site Controls</h1>
        <p className="text-label-md text-on-surface-variant">
          Bật/tắt maintenance toàn site và public login flow. Cả hai đều có in-process cache 5s
          — flip cần tối đa 5s để propagate tới tất cả Vercel instances.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="font-display text-headline-sm font-bold text-on-surface">Maintenance</h2>
        <MaintenanceToggle initiallyOn={maintenanceOn} />
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-headline-sm font-bold text-on-surface">Public login</h2>
        <LoginFlagToggle initiallyOn={loginOn} />
      </section>

      <section className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-body-sm">
        <h2 className="mb-2 font-semibold text-on-surface">Cơ chế</h2>
        <ul className="list-disc space-y-1 pl-5 text-on-surface-variant">
          <li>
            KV flags: <code>{MAINTENANCE_KEY}</code> + <code>{LOGIN_FLAG_KEY}</code> (cả hai
            persistent, không TTL).
          </li>
          <li>
            <strong>Maintenance ON</strong>: proxy.ts trả 503 + HTML &quot;Đang bảo trì&quot; cho
            mọi page navigation (admin bypass tự động qua JWT).
          </li>
          <li>
            <strong>Login OFF</strong>: <code>/sign-in</code> trả 404 (kể cả khi đoán đúng path),
            topnav không hiển thị nút đăng nhập. User không có UI entry point. Admin bypass.
          </li>
          <li>
            Bypass whitelist trong proxy: <code>/api/whoami</code>, <code>/api/health</code>,{' '}
            <code>/maintenance-ok</code>.
          </li>
          <li>
            CLI fallback: <code>pnpm run maintenance on|off|status</code> (login flag chưa có
            CLI — dùng admin UI hoặc thêm script sau).
          </li>
        </ul>
      </section>
    </div>
  );
}

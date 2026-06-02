import type { Metadata } from 'next';
import { kv, kvAvailable } from '@/lib/quota/kv-client';
import { MAINTENANCE_KEY } from '@/lib/maintenance/maintenance-mode';
import { MaintenanceToggle } from './maintenance-toggle';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Maintenance — Admin',
  robots: { index: false, follow: false },
};

async function readFlag(): Promise<boolean> {
  if (!kvAvailable) return false;
  try {
    const raw = await kv.get<unknown>(MAINTENANCE_KEY);
    return raw === '1' || raw === 1;
  } catch {
    return false;
  }
}

export default async function AdminMaintenancePage() {
  const isOn = await readFlag();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-display-sm font-bold text-primary">Maintenance</h1>
        <p className="text-label-md text-on-surface-variant">
          Bật để chặn tất cả user truy cập site. Trả 503 + HTML &quot;Đang bảo trì&quot; cho mọi page route.
        </p>
      </header>

      <MaintenanceToggle initiallyOn={isOn} />

      <section className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-body-sm">
        <h2 className="mb-2 font-semibold text-on-surface">Cơ chế</h2>
        <ul className="list-disc space-y-1 pl-5 text-on-surface-variant">
          <li>
            Flag trong KV: <code>{MAINTENANCE_KEY}</code> = &apos;1&apos; → maintenance ON.
          </li>
          <li>
            proxy.ts intercept page navigations và trả 503 + HTML khi ON.
          </li>
          <li>
            API routes (LLM endpoints) đã được gate bởi kill-switches; <code>/api/auth/*</code> không
            bị chặn ở đây nhưng UI không có entry point khi <code>/sign-in</code> là 503.
          </li>
          <li>
            Bypass whitelist trong proxy: <code>/api/whoami</code>, <code>/api/health</code>,{' '}
            <code>/maintenance-ok</code>.
          </li>
          <li>
            5s in-process cache trên KV check — flip cần tối đa 5s mới propagate tới tất cả warm
            instances.
          </li>
          <li>
            Hoặc dùng CLI: <code>pnpm run maintenance on|off|status</code>.
          </li>
        </ul>
      </section>
    </div>
  );
}

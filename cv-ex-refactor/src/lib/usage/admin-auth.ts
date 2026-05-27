import { env } from '@/lib/env';

function adminIds(): Set<string> {
  return new Set(
    (env.ADMIN_USER_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

export function isAdminId(userId: string | undefined | null): boolean {
  if (!userId) return false;
  return adminIds().has(userId);
}

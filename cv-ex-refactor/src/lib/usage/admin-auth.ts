import { env } from '@/lib/env';

function parseCsv(raw: string | undefined | null): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

function adminIds(): Set<string> {
  return parseCsv(env.ADMIN_USER_IDS);
}

function adminEmails(): Set<string> {
  return new Set(Array.from(parseCsv(env.ADMIN_USER_EMAILS)).map((e) => e.toLowerCase()));
}

export function isAdminId(userId: string | undefined | null): boolean {
  if (!userId) return false;
  return adminIds().has(userId);
}

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return adminEmails().has(email.toLowerCase());
}

/**
 * Aggregate admin check — true when the session user matches either
 * ADMIN_USER_IDS (Google sub) or ADMIN_USER_EMAILS (case-insensitive).
 * Email-based admin is easier to manage operationally because you can add
 * a teammate without first asking them to log in and reading their userId
 * from KV usage logs.
 */
export function isAdminUser(
  user: { id?: string | null; email?: string | null } | null | undefined,
): boolean {
  if (!user) return false;
  if (isAdminId(user.id)) return true;
  if (isAdminEmail(user.email)) return true;
  return false;
}

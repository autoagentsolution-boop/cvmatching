import { auth } from '@/auth';
import type { Session } from 'next-auth';

/**
 * Server-side helper to retrieve the current session.
 * Returns null on any auth() failure (missing secret, provider misconfig) so
 * the UI can degrade gracefully to a logged-out state in dev without crashing.
 * Production must configure AUTH_SECRET + Google credentials for real sessions.
 */
export async function getSession(): Promise<Session | null> {
  try {
    return await auth();
  } catch {
    return null;
  }
}

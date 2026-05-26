import { auth } from '@/auth';
import type { Session } from 'next-auth';

/**
 * Server-side helper to retrieve the current session.
 * Wraps auth() for easier mocking in tests and future cross-cutting logic.
 * Call from server components, route handlers, or server actions only.
 */
export async function getSession(): Promise<Session | null> {
  return auth();
}

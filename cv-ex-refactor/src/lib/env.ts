import { z } from 'zod';

/**
 * Server-only environment variables validated at startup.
 * NEVER import this file from client components or pages that run on the client.
 * Phase 01: all fields optional so the health route works without real secrets.
 * Phase 02 will tighten required fields (AUTH_SECRET, GOOGLE_*, KV_*).
 */
const serverSchema = z.object({
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  NEXTAUTH_URL: z.string().url().optional(),
});

export const env = serverSchema.parse(process.env);

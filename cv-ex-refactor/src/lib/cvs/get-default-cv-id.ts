import { listUserCvs } from './repo';

/**
 * Returns the default CV id for a user, falling back to the most recently
 * updated CV when no explicit default is set. Returns null when the user has
 * no CVs yet.
 */
export async function getDefaultCvId(userId: string): Promise<string | null> {
  const cvs = await listUserCvs(userId);
  if (cvs.length === 0) return null;
  const defaultCv = cvs.find((cv) => cv.isDefault) ?? cvs[0];
  return defaultCv?.id ?? null;
}

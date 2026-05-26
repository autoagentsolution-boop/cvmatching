const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

/**
 * Parse a File to plain text.
 * - .txt: read directly in the browser (no network call)
 * - .docx / .pdf: POST to /api/parse (Phase 04 endpoint — returns 404 until then)
 *
 * Throws with a user-readable message on size, format, or network errors.
 */
export async function parseFile(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error('File exceeds 4 MB limit. Please reduce the file size and try again.');
  }

  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'txt') {
    return file.text();
  }

  if (ext === 'docx' || ext === 'pdf') {
    const fd = new FormData();
    fd.append('file', file);

    const res = await fetch('/api/parse', { method: 'POST', body: fd });

    if (!res.ok) {
      let message = `Parse failed: HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: { message?: string } | string };
        if (typeof body.error === 'string') message = body.error;
        else if (typeof body.error === 'object' && body.error?.message) {
          message = body.error.message;
        }
      } catch {
        // non-JSON body — use default message
      }
      throw new Error(message);
    }

    const data = (await res.json()) as { text: string };
    return data.text;
  }

  throw new Error(
    `Unsupported file format ".${ext ?? 'unknown'}". Accepted formats: .txt, .docx, .pdf`,
  );
}

export function safeParseJson<T = unknown>(raw: string): T | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    /* fall through to fenced/bracket extraction */
  }

  const fenceMatch = trimmed.match(/```(?:json|markdown|md)?\s*\n?([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch {
      /* continue */
    }
  }

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1)) as T;
    } catch {
      return null;
    }
  }

  return null;
}

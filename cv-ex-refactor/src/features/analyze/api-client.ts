import { buildErrorMessage, parseErrorBody } from '@/lib/llm/humanize-error';
import type {
  AnalyzeRequest,
  AnalyzeRequestLLM,
  AnalysisResult,
  GenerateCvRequest,
  Language,
} from './types';

/**
 * POST /api/analyze — returns AnalysisResult.
 * Returns 404 until Phase 06 ships; callers should handle the thrown Error
 * and display it via ErrorState.
 */
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// BYOK key never travels in fetch bodies or custom headers — the user
// registers it once via /api/keys/store, the server vault assigns a token,
// and that token rides along automatically in the httpOnly cookie.
export async function callAnalyze(payload: AnalyzeRequest): Promise<AnalysisResult> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error(buildErrorMessage(await parseErrorBody(res), 'Phân tích thất bại'));
  }
  return res.json() as Promise<AnalysisResult>;
}

/**
 * POST /api/generate-cv — returns refined CV as Markdown string.
 * Mirrors generateMatchedCV() in cv_fit_scoring_app.html (tone/length/extraInstructions fields).
 * Returns 404 until Phase 06 ships.
 */
export interface GenerateCvResult {
  /** The CV markdown — safe to download / send to recruiter as-is. */
  markdown: string;
  /** Refine notes (Changes Made + Gaps) — for candidate's review only. Null when LLM emits none. */
  refineNotes: string | null;
}

export async function callGenerateCv(payload: GenerateCvRequest): Promise<GenerateCvResult> {
  const res = await fetch('/api/generate-cv', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error(buildErrorMessage(await parseErrorBody(res), 'Tạo CV thất bại'));
  }
  const data = (await res.json()) as { markdown: string; refineNotes?: string | null };
  return { markdown: data.markdown, refineNotes: data.refineNotes ?? null };
}

/**
 * POST /api/extract-must-haves — returns hard-gate requirements parsed from JD.
 * Only the 404 path falls back to a deterministic heuristic (endpoint not deployed yet).
 * All other failures including 401 surface to the caller so the user sees real errors,
 * not silently-degraded heuristic output.
 */
export async function callExtractMustHaves(
  jdText: string,
  llm: AnalyzeRequestLLM,
  language: Language,
): Promise<string[]> {
  const res = await fetch('/api/extract-must-haves', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ jdText, llm, language }),
    credentials: 'same-origin',
  });
  if (res.ok) {
    const data = (await res.json()) as { mustHaves: string[] };
    return data.mustHaves;
  }
  if (res.status === 404) {
    return heuristicMustHaves(jdText);
  }
  throw new Error(buildErrorMessage(await parseErrorBody(res), 'Trích yêu cầu bắt buộc thất bại'));
}

/**
 * Phase 1 fallback — picks short lines that look like requirement bullets.
 * Replaced by LLM extraction in Phase 06.
 */
function heuristicMustHaves(jdText: string): string[] {
  const lines = jdText
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[-•*·]\s*/, ''))
    .filter((l) => l.length > 0 && l.length <= 140);
  const requireRe = /(required|must have|must-have|minimum|at least|years|proficien|expert|fluent)/i;
  const picked = lines.filter((l) => requireRe.test(l));
  const seen = new Set<string>();
  const dedup: string[] = [];
  for (const item of picked.length > 0 ? picked : lines) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(item);
    if (dedup.length >= 6) break;
  }
  return dedup;
}

/**
 * POST /api/scrape — returns scraped JD text from a URL.
 * Returns 404 until Phase 05 ships.
 */
// ---- BYOK vault client helpers ---------------------------------------------

export interface ByokStatus {
  hasKey: boolean;
  tail: string | null;
}

export async function fetchByokStatus(): Promise<ByokStatus> {
  const res = await fetch('/api/keys/status', { credentials: 'same-origin' });
  if (!res.ok) return { hasKey: false, tail: null };
  return res.json() as Promise<ByokStatus>;
}

export async function storeByokKey(apiKey: string): Promise<{ tail: string }> {
  const res = await fetch('/api/keys/store', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ apiKey }),
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error(buildErrorMessage(await parseErrorBody(res), 'Lưu API key thất bại'));
  }
  return res.json() as Promise<{ tail: string }>;
}

export async function clearByokKey(): Promise<void> {
  await fetch('/api/keys/clear', {
    method: 'POST',
    credentials: 'same-origin',
  });
}

export async function callScrapeJd(url: string): Promise<string> {
  const res = await fetch('/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    throw new Error(buildErrorMessage(await parseErrorBody(res), 'Lấy nội dung JD thất bại'));
  }
  const data = (await res.json()) as { text: string };
  return data.text;
}

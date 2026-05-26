import type { AnalyzeRequest, AnalysisResult, GenerateCvRequest } from './types';

async function parseErrorBody(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } | string };
    if (typeof body.error === 'string') return body.error;
    if (typeof body.error === 'object' && body.error?.message) return body.error.message;
  } catch {
    // non-JSON body — fall through
  }
  return `HTTP ${res.status}`;
}

/**
 * POST /api/analyze — returns AnalysisResult.
 * Returns 404 until Phase 06 ships; callers should handle the thrown Error
 * and display it via ErrorState.
 */
export async function callAnalyze(payload: AnalyzeRequest): Promise<AnalysisResult> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const msg = await parseErrorBody(res);
    throw new Error(`Analyze failed: ${msg}`);
  }
  return res.json() as Promise<AnalysisResult>;
}

/**
 * POST /api/generate-cv — returns refined CV as Markdown string.
 * Mirrors generateMatchedCV() in cv_fit_scoring_app.html (tone/length/extraInstructions fields).
 * Returns 404 until Phase 06 ships.
 */
export async function callGenerateCv(payload: GenerateCvRequest): Promise<string> {
  const res = await fetch('/api/generate-cv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const msg = await parseErrorBody(res);
    throw new Error(`Generate CV failed: ${msg}`);
  }
  const data = (await res.json()) as { markdown: string };
  return data.markdown;
}

/**
 * POST /api/extract-must-haves — returns hard-gate requirements parsed from JD.
 * Returns 404 until Phase 06 ships; the call falls back to a deterministic
 * heuristic so the UI stays usable during Phase 1 visual development.
 */
export async function callExtractMustHaves(jdText: string): Promise<string[]> {
  try {
    const res = await fetch('/api/extract-must-haves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jdText }),
    });
    if (res.ok) {
      const data = (await res.json()) as { mustHaves: string[] };
      return data.mustHaves;
    }
    if (res.status !== 404) {
      const msg = await parseErrorBody(res);
      throw new Error(`Extract must-haves failed: ${msg}`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Extract must-haves failed')) {
      throw err;
    }
  }
  return heuristicMustHaves(jdText);
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
export async function callScrapeJd(url: string): Promise<string> {
  const res = await fetch('/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const msg = await parseErrorBody(res);
    throw new Error(`Scrape failed: ${msg}`);
  }
  const data = (await res.json()) as { text: string };
  return data.text;
}

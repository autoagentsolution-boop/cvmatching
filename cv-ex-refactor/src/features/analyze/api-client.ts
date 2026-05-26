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

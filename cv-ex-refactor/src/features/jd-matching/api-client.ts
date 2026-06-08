import { buildErrorMessage, parseErrorBody } from '@/lib/llm/humanize-error';
import type { AnalyzeRequestLLM, Language } from '@/features/analyze/types';
import type { JdInsights } from '@/lib/llm/normalize-jd-insights';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export interface CallJdInsightsArgs {
  cvText: string;
  jdText: string;
  analyzeSummary?: string;
  llm: AnalyzeRequestLLM;
  language: Language;
}

export async function callJdInsights(args: CallJdInsightsArgs): Promise<JdInsights> {
  const res = await fetch('/api/jd-insights', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(args),
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error(buildErrorMessage(await parseErrorBody(res), 'JD Insights thất bại'));
  }
  return res.json() as Promise<JdInsights>;
}

import { buildErrorMessage, parseErrorBody } from '@/lib/llm/humanize-error';
import type {
  CareerPathRequest,
  CareerPathResult,
  PathSuggestion,
  SuggestPathsRequest,
} from './types';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export interface CareerPathResponse extends CareerPathResult {
  quotaRemaining: number | null;
}

export async function callCareerPath(payload: CareerPathRequest): Promise<CareerPathResponse> {
  const res = await fetch('/api/career-path', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error(buildErrorMessage(await parseErrorBody(res), 'Tạo lộ trình thất bại'));
  }
  return res.json() as Promise<CareerPathResponse>;
}

export async function callSuggestPaths(payload: SuggestPathsRequest): Promise<PathSuggestion[]> {
  const res = await fetch('/api/career-path/suggest', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error(buildErrorMessage(await parseErrorBody(res), 'Đề xuất hướng phát triển thất bại'));
  }
  const data = (await res.json()) as { suggestions: PathSuggestion[] };
  return data.suggestions;
}

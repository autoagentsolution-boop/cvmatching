import { buildErrorMessage, parseErrorBody } from '@/lib/llm/humanize-error';
import type { CareerPathRequest, CareerPathResult } from './types';

export interface CareerPathResponse extends CareerPathResult {
  quotaRemaining: number | null;
}

export async function callCareerPath(payload: CareerPathRequest): Promise<CareerPathResponse> {
  const res = await fetch('/api/career-path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error(buildErrorMessage(await parseErrorBody(res), 'Tạo lộ trình thất bại'));
  }
  return res.json() as Promise<CareerPathResponse>;
}

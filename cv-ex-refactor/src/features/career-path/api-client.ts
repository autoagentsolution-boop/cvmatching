import type { CareerPathRequest, CareerPathResult } from './types';

interface ErrorBody {
  code: string;
  message: string;
}

async function parseErrorBody(res: Response): Promise<ErrorBody> {
  try {
    const body = (await res.json()) as {
      error?: { code?: string; message?: string } | string;
    };
    if (typeof body.error === 'string') return { code: 'unknown', message: body.error };
    if (typeof body.error === 'object' && body.error) {
      return {
        code: body.error.code ?? 'unknown',
        message: body.error.message ?? `HTTP ${res.status}`,
      };
    }
  } catch {
    // non-JSON
  }
  return { code: 'unknown', message: `HTTP ${res.status}` };
}

function humanizeServerCode(body: ErrorBody, fallback: string): string {
  if (
    body.code === 'invalid_input' ||
    body.code === 'quota_exceeded' ||
    body.code === 'unauthorized' ||
    body.code === 'shared_key_disabled' ||
    body.code === 'rate_limited'
  ) {
    return body.message;
  }
  if (body.code === 'llm_provider_error') {
    return body.message || 'AI gặp sự cố. Thử lại hoặc đổi model trong Settings.';
  }
  return `${fallback}: ${body.message}`;
}

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
    throw new Error(humanizeServerCode(await parseErrorBody(res), 'Tạo lộ trình thất bại'));
  }
  return res.json() as Promise<CareerPathResponse>;
}

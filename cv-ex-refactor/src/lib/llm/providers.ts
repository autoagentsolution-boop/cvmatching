import type { LlmConfigT } from '@/lib/schemas/llm-request';
import { callGemini, type LlmCallResult } from './call-gemini';
import { callOpenAI } from './call-openai';

const OPENAI_DEFAULT_BASE = 'https://api.openai.com/v1';

export interface CallLlmOpts {
  config: LlmConfigT & { apiKey: string };
  system: string;
  user: string;
  expectJson: boolean;
}

export type { LlmCallResult };

export async function callLLM({ config, system, user, expectJson }: CallLlmOpts): Promise<LlmCallResult> {
  if (config.provider === 'gemini') {
    return callGemini({
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature,
      system,
      user,
      expectJson,
    });
  }

  const baseUrl =
    config.provider === 'openai' ? OPENAI_DEFAULT_BASE : (config.baseUrl ?? '').replace(/\/$/, '');
  if (!baseUrl) throw new Error('Provider tuỳ chỉnh cần baseUrl');

  return callOpenAI({
    apiKey: config.apiKey,
    baseUrl,
    model: config.model,
    temperature: config.temperature,
    system,
    user,
    expectJson,
  });
}

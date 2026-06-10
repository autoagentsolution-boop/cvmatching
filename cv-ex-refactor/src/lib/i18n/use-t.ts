'use client';

import { useAnalysis } from '@/features/analyze/analysis-store';
import { translate, type Locale, type MessageKey } from './messages';

/**
 * Resolve the effective UI locale from the analyze-store `language` field.
 * 'auto' resolves to 'vi' (Vietnamese-first product); 'en' / 'vi' pass
 * through. We could be smarter (browser locale, account preference) but
 * the user already has an explicit toggle — respect it directly.
 */
export function resolveLocale(language: 'en' | 'vi' | 'auto'): Locale {
  if (language === 'en') return 'en';
  return 'vi';
}

/**
 * Hook returning a `t(key, vars?)` translator function. Components call
 * `const t = useT()` then `t('careerPath.title')`. Re-renders when the
 * store language changes — instant toggle.
 */
export function useT(): (key: MessageKey, vars?: Record<string, string | number>) => string {
  const language = useAnalysis((s) => s.language);
  const locale = resolveLocale(language);
  return (key, vars) => translate(locale, key, vars);
}

/**
 * Read the current locale outside of t() — useful when a component needs
 * to conditionally show language-specific imagery / icons.
 */
export function useLocale(): Locale {
  const language = useAnalysis((s) => s.language);
  return resolveLocale(language);
}

import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export interface ExtractedArticle {
  title: string;
  text: string;
  byline?: string;
  length: number;
  siteName?: string;
}

export function extractReadability(html: string, baseUrl: string): ExtractedArticle | null {
  let dom: JSDOM;
  try {
    dom = new JSDOM(html, { url: baseUrl });
  } catch {
    return null;
  }

  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  if (!article || !article.textContent) return null;

  const result: ExtractedArticle = {
    title: (article.title ?? '').trim(),
    text: article.textContent.trim(),
    length: article.length ?? article.textContent.length,
  };
  if (article.byline) result.byline = article.byline;
  if (article.siteName) result.siteName = article.siteName;
  return result;
}

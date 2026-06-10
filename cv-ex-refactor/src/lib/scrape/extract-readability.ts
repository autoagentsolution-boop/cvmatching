// Lightweight main-content extractor — replaces jsdom+@mozilla/readability.
//
// Why no jsdom: jsdom 29 → html-encoding-sniffer 6 → @exodus/bytes (ESM-only)
// breaks on Vercel serverless (require() of ESM throws at runtime).
// Memory: feedback_vercel_serverless_jsdom_dynamic_import (related cold-start
// fix) was for module-init crash; this is the runtime variant of the same
// jsdom-deps mess. Permanent fix: don't ship jsdom in route bundles.
//
// cheerio is pure-CJS, no native deps, ships clean to Vercel. Quality of
// extraction is heuristic (not as smart as Readability's score-based pick)
// but good enough for the fallback path — known-source JDs hit JSON-LD first.

import * as cheerio from 'cheerio';

export interface ExtractedArticle {
  title: string;
  text: string;
  byline?: string;
  length: number;
  siteName?: string;
}

const NOISE_SELECTORS = [
  'script', 'style', 'noscript', 'iframe', 'svg',
  'nav', 'header', 'footer', 'aside',
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  '.nav', '.navbar', '.menu', '.sidebar', '.footer', '.header',
  '.ad', '.ads', '.advertisement', '.cookie', '.cookies',
  '.share', '.social', '.related', '.comments',
];

const MAIN_SELECTORS = ['main', 'article', '[role="main"]', '#main', '#content', '.content', '.main-content'];

function pickMainNode($: cheerio.CheerioAPI): cheerio.Cheerio<any> {
  for (const sel of MAIN_SELECTORS) {
    const el = $(sel).first();
    if (el.length > 0 && el.text().trim().length > 200) return el;
  }
  // Fallback: longest <div> by text length. Cap candidates to avoid O(N²).
  let best: cheerio.Cheerio<any> | null = null;
  let bestLen = 0;
  $('div, section').each((_, el) => {
    const $el = $(el);
    const len = $el.text().trim().length;
    if (len > bestLen && len < 50_000) {
      best = $el;
      bestLen = len;
    }
  });
  return best ?? $('body');
}

export function extractReadability(html: string, _baseUrl: string): ExtractedArticle | null {
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch {
    return null;
  }

  $(NOISE_SELECTORS.join(',')).remove();

  const main = pickMainNode($);
  const text = main.text().replace(/\s+/g, ' ').trim();
  if (text.length < 50) return null;

  const title =
    ($('meta[property="og:title"]').attr('content') ||
      $('title').first().text() ||
      $('h1').first().text() ||
      '').trim();
  const siteName =
    ($('meta[property="og:site_name"]').attr('content') ||
      $('meta[name="application-name"]').attr('content') ||
      '').trim();
  const byline =
    ($('meta[name="author"]').attr('content') ||
      $('[rel="author"]').first().text() ||
      '').trim();

  const result: ExtractedArticle = {
    title,
    text,
    length: text.length,
  };
  if (byline) result.byline = byline;
  if (siteName) result.siteName = siteName;
  return result;
}

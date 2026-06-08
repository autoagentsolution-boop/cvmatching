// Scrape a job description from a job-board URL.
//
// Supported sources (detected by hostname):
//   topcv.vn       — JSON-LD JobPosting (parseJobPostingLd)
//   itviec.com     — JSON-LD JobPosting (parseJobPostingLd)
//   vietnamworks.com — JSON-LD JobPosting (parseJobPostingLd)
//   vieclam24h.vn  — JSON-LD JobPosting (parseJobPostingLd)
//
// All four sources embed schema.org/JobPosting in a <script ld+json> block
// on the detail page, so a single parser handles all of them.
//
// Falls back to @mozilla/readability for unsupported hosts — extracts the
// main article text which is usually sufficient for JD context.
//
// Uses the existing fetch-html helper (browser UA, 8s timeout, 5MB cap).
// Does NOT use fetchViaCurl (no curl dependency on Vercel Function runtime).
// Cloudflare-gated detail pages will return 403 from Vercel — callers should
// surface that as a user-visible error rather than silently failing.

import { parseJobPostingLd } from '@/lib/scrape/vl24h-parser';
import { fetchHtml } from '@/lib/scrape/fetch-html';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export interface ScrapedJd {
  title?: string | undefined;
  description: string;
  source?: string | undefined;
}

type KnownSource = 'topcv' | 'itviec' | 'vnw' | 'vl24h' | 'other';

function detectSource(hostname: string): KnownSource {
  if (hostname.includes('topcv.vn')) return 'topcv';
  if (hostname.includes('itviec.com')) return 'itviec';
  if (hostname.includes('vietnamworks.com')) return 'vnw';
  if (hostname.includes('vieclam24h.vn')) return 'vl24h';
  return 'other';
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetch a job-board detail page and extract the JD text + title.
 *
 * Throws on network errors, non-200 HTTP status, or when no content can
 * be extracted (min 50 chars). The caller (API route) should catch and
 * return an appropriate HTTP error — no silent fallback.
 */
export async function scrapeJdFromUrl(rawUrl: string): Promise<ScrapedJd> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  const source = detectSource(parsedUrl.hostname);

  let html: string;
  try {
    const result = await fetchHtml(parsedUrl);
    html = result.html;
  } catch (e) {
    throw new Error(
      `Failed to fetch URL (${e instanceof Error ? e.message : String(e)}). ` +
        'The page may be Cloudflare-protected — try pasting the JD text directly.',
    );
  }

  // Attempt JSON-LD JobPosting extraction for known sources first.
  const ld = parseJobPostingLd(html);
  if (ld) {
    const desc = stripHtml(ld.description ?? '');
    if (desc.length >= 50) {
      return {
        title: ld.title?.trim(),
        description: desc,
        source,
      };
    }
  }

  // Fallback: Readability main-content extraction — works for any HTML page.
  const dom = new JSDOM(html, { url: rawUrl });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  const fallbackText = article?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  if (fallbackText.length < 50) {
    throw new Error(
      'Could not extract job description content from the page. ' +
        'Please paste the JD text directly.',
    );
  }

  return {
    title: article?.title?.trim() || undefined,
    description: fallbackText,
    source,
  };
}

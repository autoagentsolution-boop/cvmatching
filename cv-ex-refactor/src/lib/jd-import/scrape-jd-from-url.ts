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
import { extractReadability } from '@/lib/scrape/extract-readability';

// NOTE: fallback extraction uses cheerio (pure-CJS, no native deps).
// Prior implementation dynamic-imported jsdom + @mozilla/readability —
// jsdom's transitive html-encoding-sniffer 6 → @exodus/bytes (ESM-only)
// crashes on Vercel serverless at runtime even when imported lazily.
// cheerio ships clean; quality of fallback is heuristic but JSON-LD
// path handles all 4 known sources (topcv/itviec/vnw/vl24h) without it.

export interface ScrapedJd {
  title?: string | undefined;
  /** Plain-text JD body — fed to /api/analyze. Always present. */
  description: string;
  /** Cleaned HTML body for reader-view rendering. Mirrors `description` in
   *  meaning but preserves headings/lists/formatting from the source page.
   *  Empty when the source returned no salvageable HTML. */
  html?: string | undefined;
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
    const rawDescription = ld.description ?? '';
    const desc = stripHtml(rawDescription);
    if (desc.length >= 50) {
      // JSON-LD often stores description as HTML — keep it for reader view.
      // When the LD payload is plain text we fall back to <pre>-style by
      // wrapping in a paragraph so spacing is preserved on render.
      const looksLikeHtml = /<\w+[\s>]/.test(rawDescription);
      const htmlBody = looksLikeHtml
        ? rawDescription
        : `<p>${escapeHtml(rawDescription)}</p>`;
      return {
        title: ld.title?.trim(),
        description: desc,
        html: htmlBody,
        source,
      };
    }
  }

  // Fallback: cheerio-based main-content extraction. Quality is heuristic
  // (looks for <main>/<article>/<role=main> then largest <div>) but enough
  // for unknown-source JDs — known sources already returned via JSON-LD.
  const article = extractReadability(html, rawUrl);
  if (!article || article.text.length < 50) {
    throw new Error(
      'Could not extract job description content from the page. ' +
        'Please paste the JD text directly.',
    );
  }

  return {
    title: article.title.trim() || undefined,
    description: article.text,
    // cheerio path doesn't preserve sanitized HTML; reader view falls back
    // to plain-text rendering for unknown sources.
    html: undefined,
    source,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

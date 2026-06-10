// Strip Markdown-active characters from a short inline string so it can
// be safely interpolated into headings / link labels / table cells.
//
// Removes: [ ] * # ` < > — covers heading injection, bold/italic, code-
// span, link label, blockquote, and HTML escape. Trims whitespace and
// caps length so a 5000-char JD-derived title can't blow up an h1.
//
// Trade-off: `#` is both a heading marker and a literal char in some
// company names (e.g. "C# Solutions"). Acceptable on this surface — the
// raw title shows elsewhere; only headings need defense.

export function sanitizeMarkdownInline(s: string, maxLen = 80): string {
  return s
    .replace(/[\[\]\*\#\`\<\>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

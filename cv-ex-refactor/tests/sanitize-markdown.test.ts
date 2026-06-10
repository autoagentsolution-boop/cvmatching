import { describe, it, expect } from 'vitest';
import { sanitizeMarkdownInline } from '@/lib/llm/sanitize-markdown';

describe('sanitizeMarkdownInline', () => {
  it('strips bracket-class chars: [ ] * # ` < >', () => {
    expect(sanitizeMarkdownInline('Senior [Backend] Engineer*')).toBe('Senior Backend Engineer');
    expect(sanitizeMarkdownInline('### Tech Lead `Quick`')).toBe('Tech Lead Quick');
    expect(sanitizeMarkdownInline('<script>X</script>')).toBe('scriptX/script');
  });

  it('trims surrounding whitespace and collapses internal runs', () => {
    expect(sanitizeMarkdownInline('  Acme   Corp  ')).toBe('Acme Corp');
  });

  it('caps to maxLen (default 80)', () => {
    const long = 'A'.repeat(200);
    expect(sanitizeMarkdownInline(long).length).toBe(80);
  });

  it('respects custom maxLen', () => {
    expect(sanitizeMarkdownInline('Hello World', 5)).toBe('Hello');
  });

  it('leaves benign chars alone (parens, dashes, ampersands, slashes)', () => {
    expect(sanitizeMarkdownInline('Doe & Co. (NYSE: DOE) — VP')).toBe('Doe & Co. (NYSE: DOE) — VP');
  });

  it('accepts Vietnamese diacritics', () => {
    expect(sanitizeMarkdownInline('Kỹ sư Phần mềm Cao cấp')).toBe('Kỹ sư Phần mềm Cao cấp');
  });

  it('trade-off: # in company names ("C# Solutions") becomes "C Solutions"', () => {
    expect(sanitizeMarkdownInline('C# Solutions')).toBe('C Solutions');
  });
});

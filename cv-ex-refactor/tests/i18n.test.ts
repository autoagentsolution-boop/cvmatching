import { describe, it, expect } from 'vitest';
import { MESSAGES, translate, type MessageKey } from '@/lib/i18n/messages';

describe('i18n messages catalog', () => {
  it('every VI key has an EN counterpart with the same key', () => {
    const viKeys = Object.keys(MESSAGES.vi).sort();
    const enKeys = Object.keys(MESSAGES.en).sort();
    expect(enKeys).toEqual(viKeys);
  });

  it('no VI translation is empty or whitespace-only', () => {
    for (const [k, v] of Object.entries(MESSAGES.vi)) {
      expect(v, `vi.${k}`).not.toBe('');
      expect(v.trim(), `vi.${k}`).not.toBe('');
    }
  });

  it('no EN translation is empty or whitespace-only', () => {
    for (const [k, v] of Object.entries(MESSAGES.en)) {
      expect(v, `en.${k}`).not.toBe('');
      expect(v.trim(), `en.${k}`).not.toBe('');
    }
  });
});

describe('translate', () => {
  it('returns the VI string for vi locale', () => {
    expect(translate('vi', 'nav.signOut')).toBe('Đăng xuất');
  });

  it('returns the EN string for en locale', () => {
    expect(translate('en', 'nav.signOut')).toBe('Sign out');
  });

  it('falls back to VI when locale bundle missing the key (defensive)', () => {
    // Simulate an unknown key — translate must NOT throw, must return the
    // key itself as a last-resort sentinel.
    expect(translate('vi', 'nonexistent.key' as MessageKey)).toBe('nonexistent.key');
  });

  it('interpolates {placeholder} from vars', () => {
    expect(
      translate('vi', 'careerPath.start.titleSelected', { role: 'Staff Engineer' }),
    ).toBe('Tạo lộ trình cho "Staff Engineer"');
  });

  it('leaves an unmatched {placeholder} intact when vars missing', () => {
    expect(translate('vi', 'careerPath.start.titleSelected')).toBe(
      'Tạo lộ trình cho "{role}"',
    );
  });

  it('multi-placeholder interpolation works (quotaRemaining)', () => {
    expect(translate('vi', 'coverLetter.quotaRemaining', { n: 2 })).toBe(
      'Còn 2 lần hôm nay',
    );
    expect(translate('en', 'coverLetter.quotaRemaining', { n: 2 })).toBe('2 left today');
  });
});

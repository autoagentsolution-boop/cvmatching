import { describe, expect, it } from 'vitest';
import { buildOrderMemo, generateVietQRUrl, MEMO_PREFIX } from '@/lib/payments/sepay-qr';

describe('generateVietQRUrl', () => {
  it('builds a valid sepay.vn QR URL', () => {
    const url = generateVietQRUrl({
      accountNumber: '0123456789',
      bankName: 'Vietcombank',
      amountVnd: 99_000,
      content: 'RR test',
    });
    expect(url).toMatch(/^https:\/\/qr\.sepay\.vn\/img\?/);
    const params = new URL(url).searchParams;
    expect(params.get('acc')).toBe('0123456789');
    expect(params.get('bank')).toBe('Vietcombank');
    expect(params.get('amount')).toBe('99000');
    expect(params.get('des')).toBe('RR test');
  });

  it('floors fractional amounts', () => {
    const url = generateVietQRUrl({
      accountNumber: '1',
      bankName: 'VCB',
      amountVnd: 99_000.7,
      content: 'x',
    });
    expect(new URL(url).searchParams.get('amount')).toBe('99000');
  });

  it('rejects non-positive amount', () => {
    expect(() =>
      generateVietQRUrl({ accountNumber: '1', bankName: 'VCB', amountVnd: 0, content: 'x' }),
    ).toThrow();
    expect(() =>
      generateVietQRUrl({ accountNumber: '1', bankName: 'VCB', amountVnd: -1, content: 'x' }),
    ).toThrow();
  });

  it('rejects missing account/bank', () => {
    expect(() =>
      generateVietQRUrl({ accountNumber: '', bankName: 'VCB', amountVnd: 1, content: 'x' }),
    ).toThrow();
    expect(() =>
      generateVietQRUrl({ accountNumber: '1', bankName: '', amountVnd: 1, content: 'x' }),
    ).toThrow();
  });
});

describe('buildOrderMemo', () => {
  it('prefixes with RR', () => {
    expect(buildOrderMemo('abc-123')).toBe(`${MEMO_PREFIX} abc-123`);
  });
});

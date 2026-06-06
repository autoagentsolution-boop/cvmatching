import { describe, expect, it } from 'vitest';
import { normalizeUUID, parseOrderIdFromContent } from '@/lib/payments/sepay-match';

const UUID = '4e4635f4-0478-4080-a5c5-48da91f97f1e';
const STRIPPED = '4e4635f404784080a5c548da91f97f1e';

describe('normalizeUUID', () => {
  it('round-trips the standard form', () => {
    expect(normalizeUUID(UUID)).toBe(UUID);
  });

  it('re-formats dash-stripped UUID', () => {
    expect(normalizeUUID(STRIPPED)).toBe(UUID);
  });

  it('lowercases uppercase hex', () => {
    expect(normalizeUUID(UUID.toUpperCase())).toBe(UUID);
  });

  it('rejects wrong length', () => {
    expect(normalizeUUID('abc')).toBeNull();
    expect(normalizeUUID(STRIPPED.slice(0, -1))).toBeNull();
  });

  it('rejects non-hex chars', () => {
    expect(normalizeUUID(STRIPPED.slice(0, -1) + 'z')).toBeNull();
  });
});

describe('parseOrderIdFromContent — bank transformations', () => {
  it('extracts from "RR <uuid>" standard memo', () => {
    expect(parseOrderIdFromContent(`RR ${UUID}`)).toBe(UUID);
  });

  it('extracts from "RR<uuid>" (no space)', () => {
    expect(parseOrderIdFromContent(`RR${UUID}`)).toBe(UUID);
  });

  it('extracts from stripped dashes', () => {
    expect(parseOrderIdFromContent(`RR ${STRIPPED}`)).toBe(UUID);
  });

  it('extracts from prefix+UUID', () => {
    expect(parseOrderIdFromContent(`BankAPINotify ${STRIPPED}`)).toBe(UUID);
  });

  it('extracts from UUID-only memo', () => {
    expect(parseOrderIdFromContent(STRIPPED)).toBe(UUID);
  });

  it('extracts case-insensitively', () => {
    expect(parseOrderIdFromContent(`rr ${UUID.toUpperCase()}`)).toBe(UUID);
  });

  it('returns null when nothing matches', () => {
    expect(parseOrderIdFromContent('thanks for the transfer')).toBeNull();
    expect(parseOrderIdFromContent('')).toBeNull();
    expect(parseOrderIdFromContent(null)).toBeNull();
    expect(parseOrderIdFromContent(undefined)).toBeNull();
  });

  it('returns null on partial / malformed UUID', () => {
    expect(parseOrderIdFromContent(`RR ${STRIPPED.slice(0, 30)}`)).toBeNull();
  });
});

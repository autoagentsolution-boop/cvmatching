// SePay webhook → order matching. Multi-strategy fallback because banks
// transform memo content (strip dashes, drop prefix, lowercase) before SePay
// receives it. Order of strategies: content-parse → amount + creation-window
// → amount-only (last resort, single-match required).

import { and, eq, gte, lte } from 'drizzle-orm';
import { getDb, orders, type OrderRow } from '@/db';

const UUID_HEX = /[0-9a-f]/i;

// 8-4-4-4-12 with optional dashes anywhere. Tolerates bank dash-stripping.
const UUID_PATTERN =
  /([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12})/i;

export function normalizeUUID(input: string): string | null {
  const cleaned = input.replace(/-/g, '').toLowerCase();
  if (cleaned.length !== 32 || !UUID_HEX.test(cleaned)) return null;
  if (!/^[0-9a-f]+$/.test(cleaned)) return null;
  return [
    cleaned.slice(0, 8),
    cleaned.slice(8, 12),
    cleaned.slice(12, 16),
    cleaned.slice(16, 20),
    cleaned.slice(20),
  ].join('-');
}

/**
 * Extract a UUID from a free-form bank memo. Accepts:
 *   "RR <uuid>"             standard
 *   "RR<uuid>" (no space)   bank space-strip
 *   "<uuid>"                bank prefix-strip
 *   any prefix + uuid       bank append behavior
 */
export function parseOrderIdFromContent(content: string | null | undefined): string | null {
  if (!content) return null;
  const match = content.match(UUID_PATTERN);
  const captured = match?.[1];
  if (!captured) return null;
  return normalizeUUID(captured);
}

export interface SepayWebhookPayload {
  id: number | string;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  content?: string;
  transferType?: 'in' | 'out';
  transferAmount?: number;
  accumulated?: number;
  referenceCode?: string;
  description?: string;
}

export type MatchMethod = 'content-parse' | 'amount-window' | 'amount-only';

export interface MatchResult {
  order: OrderRow | null;
  method: MatchMethod | 'none';
}

const WINDOW_MS = 30 * 60 * 1000;

export async function findOrderByTransaction(payload: SepayWebhookPayload): Promise<MatchResult> {
  const { content, transferAmount, transactionDate } = payload;
  const db = getDb();

  // Strategy 1: content → UUID.
  const parsedId = parseOrderIdFromContent(content);
  if (parsedId) {
    const rows = await db.select().from(orders).where(eq(orders.id, parsedId)).limit(1);
    if (rows[0]) return { order: rows[0], method: 'content-parse' };
  }

  // Strategy 2: pending + amount + ±30min window from transactionDate.
  if (typeof transferAmount === 'number' && transactionDate) {
    const t = new Date(transactionDate);
    if (!Number.isNaN(t.getTime())) {
      const lo = new Date(t.getTime() - WINDOW_MS);
      const hi = new Date(t.getTime() + WINDOW_MS);
      const window = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.status, 'pending'),
            eq(orders.amountVnd, transferAmount),
            gte(orders.createdAt, lo),
            lte(orders.createdAt, hi),
          ),
        )
        .limit(10);

      if (window.length === 1 && window[0]) return { order: window[0], method: 'amount-window' };
      if (window.length > 1) {
        // Closest by createdAt.
        const closest = window.reduce((acc, row) =>
          Math.abs(row.createdAt.getTime() - t.getTime()) <
          Math.abs(acc.createdAt.getTime() - t.getTime())
            ? row
            : acc,
        );
        return { order: closest, method: 'amount-window' };
      }
    }
  }

  // Strategy 3: amount-only — last resort, only if uniquely matches.
  if (typeof transferAmount === 'number') {
    const matches = await db
      .select()
      .from(orders)
      .where(and(eq(orders.status, 'pending'), eq(orders.amountVnd, transferAmount)))
      .limit(2);
    if (matches.length === 1 && matches[0]) return { order: matches[0], method: 'amount-only' };
  }

  return { order: null, method: 'none' };
}

// VietQR URL builder for SePay's image endpoint. Pure function — no I/O.
// Bank renders the QR; user scans → bank app pre-fills account/amount/memo.
// Memo must round-trip through bank dash-stripping (see sepay-match).

export interface VietQRArgs {
  accountNumber: string;
  bankName: string;
  amountVnd: number;
  content: string;
}

export function generateVietQRUrl({ accountNumber, bankName, amountVnd, content }: VietQRArgs): string {
  if (!accountNumber || !bankName) throw new Error('generateVietQRUrl: bank account/name missing');
  if (!Number.isFinite(amountVnd) || amountVnd <= 0) throw new Error('generateVietQRUrl: amount must be positive');

  const params = new URLSearchParams({
    acc: accountNumber,
    bank: bankName,
    amount: String(Math.floor(amountVnd)),
    des: content,
  });
  return `https://qr.sepay.vn/img?${params.toString()}`;
}

// Memo prefix — "RR" = ResumeRefine. Short enough that bank truncation in
// realistic 40-char memo limits still leaves the UUID intact.
export const MEMO_PREFIX = 'RR';

export function buildOrderMemo(orderId: string): string {
  return `${MEMO_PREFIX} ${orderId}`;
}

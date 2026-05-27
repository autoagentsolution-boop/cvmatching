export type FileKind = 'pdf' | 'docx' | 'txt' | 'unknown';

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46] as const; // %PDF
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] as const; // PK\x03\x04 (DOCX/XLSX/ZIP)

function matchSignature(bytes: Uint8Array, sig: readonly number[]): boolean {
  if (bytes.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[i] !== sig[i]) return false;
  }
  return true;
}

export function detectFileType(buf: ArrayBuffer): FileKind {
  const head = new Uint8Array(buf.slice(0, 8));

  if (matchSignature(head, PDF_SIGNATURE)) return 'pdf';
  if (matchSignature(head, ZIP_SIGNATURE)) return 'docx';

  const sampleLen = Math.min(buf.byteLength, 512);
  const sample = new TextDecoder('utf-8', { fatal: false }).decode(buf.slice(0, sampleLen));
  if (sampleLen === 0) return 'unknown';

  let printable = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    const isCtrl = code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d;
    if (!isCtrl) printable++;
  }
  if (printable / sample.length >= 0.95) return 'txt';

  return 'unknown';
}

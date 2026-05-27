import mammoth from 'mammoth';

export interface ParsedDocx {
  text: string;
}

export async function parseDocx(buf: ArrayBuffer): Promise<ParsedDocx> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
  return { text: result.value };
}

import { extractText, getDocumentProxy } from 'unpdf';

export interface ParsedPdf {
  text: string;
  pages: number;
}

export async function parsePdf(buf: ArrayBuffer): Promise<ParsedPdf> {
  const doc = await getDocumentProxy(new Uint8Array(buf));
  const { text, totalPages } = await extractText(doc, { mergePages: true });
  return { text, pages: totalPages };
}

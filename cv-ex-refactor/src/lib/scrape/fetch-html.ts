const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export interface FetchedHtml {
  html: string;
  finalUrl: string;
}

export async function fetchHtml(url: URL): Promise<FetchedHtml> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'vi,en;q=0.9',
      },
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error(`Content-type không phải HTML (${contentType || 'unknown'})`);
    }

    const body = res.body;
    if (!body) throw new Error('Response body rỗng');

    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.length;
        if (total > MAX_BYTES) throw new Error('Response quá lớn (>5MB)');
        chunks.push(value);
      }
    }

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    const html = new TextDecoder('utf-8', { fatal: false }).decode(merged);
    return { html, finalUrl: res.url };
  } finally {
    clearTimeout(timer);
  }
}

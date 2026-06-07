import { describe, expect, it } from 'vitest';
import { extractItemListUrls } from '@/lib/scrape/jsonld-itemlist';
import {
  extractTopcvDetailUrls,
  normalizeTopcvSlug,
} from '../scripts/ingest-topcv';
import {
  extractVnwDetailUrls,
  extractVnwNextDataUrls,
  normalizeVnwSlug,
} from '../scripts/ingest-vnw';

describe('jsonld-itemlist — extractItemListUrls', () => {
  it('extracts urls from a single ItemList block', () => {
    const html = `
      <script type="application/ld+json">
        {"@type":"ItemList","itemListElement":[
          {"url":"https://itviec.com/it-jobs/dev-a-123"},
          {"url":"https://itviec.com/it-jobs/dev-b-456"}
        ]}
      </script>
    `;
    expect(extractItemListUrls(html)).toEqual([
      'https://itviec.com/it-jobs/dev-a-123',
      'https://itviec.com/it-jobs/dev-b-456',
    ]);
  });

  it('aggregates urls across multiple ItemList blocks', () => {
    const html = `
      <script type='application/ld+json'>{"@type":"ItemList","itemListElement":[{"url":"https://a/1"}]}</script>
      <script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"url":"https://a/2"}]}</script>
    `;
    expect(extractItemListUrls(html)).toEqual(['https://a/1', 'https://a/2']);
  });

  it('ignores non-ItemList JSON-LD blocks', () => {
    const html = `
      <script type="application/ld+json">{"@type":"JobPosting","title":"x"}</script>
      <script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"url":"https://a/1"}]}</script>
    `;
    expect(extractItemListUrls(html)).toEqual(['https://a/1']);
  });

  it('survives malformed JSON-LD blocks', () => {
    const html = `
      <script type="application/ld+json">not-json</script>
      <script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"url":"https://a/1"}]}</script>
    `;
    expect(extractItemListUrls(html)).toEqual(['https://a/1']);
  });

  it('returns [] for empty html', () => {
    expect(extractItemListUrls('')).toEqual([]);
  });
});

describe('topcv — normalizeTopcvSlug', () => {
  // 2026-06-07: live TopCV listings are bare (no .html) and accept BOTH
  // viec-lam- and tim-viec-lam- prefixes. Legacy .html stripped.
  it.each([
    ['viec-lam-it', 'viec-lam-it'],
    ['tim-viec-lam-it-phan-mem', 'tim-viec-lam-it-phan-mem'],
    ['/viec-lam-it', 'viec-lam-it'],
    ['viec-lam-it.html', 'viec-lam-it'],
    ['it-phan-mem', 'viec-lam-it-phan-mem'],
    ['tim-viec-lam-lao-dong-pho-thong-cr1042', 'tim-viec-lam-lao-dong-pho-thong-cr1042'],
  ])('normalizes %s → %s', (input, expected) => {
    expect(normalizeTopcvSlug(input)).toBe(expected);
  });
});

describe('topcv — extractTopcvDetailUrls', () => {
  it('captures absolute + relative hrefs', () => {
    const html = `
      <a href="https://www.topcv.vn/viec-lam/dev-abc-12345.html">A</a>
      <a href='/viec-lam/qa-tester-99999.html'>B</a>
      <a href="https://www.topcv.vn/viec-lam/sales-555.html">C</a>
    `;
    expect(extractTopcvDetailUrls(html).sort()).toEqual([
      'https://www.topcv.vn/viec-lam/dev-abc-12345.html',
      'https://www.topcv.vn/viec-lam/qa-tester-99999.html',
      'https://www.topcv.vn/viec-lam/sales-555.html',
    ]);
  });

  it('dedups duplicates', () => {
    const html = `
      <a href="/viec-lam/x-1.html">A</a>
      <a href="/viec-lam/x-1.html">B</a>
    `;
    expect(extractTopcvDetailUrls(html)).toEqual(['https://www.topcv.vn/viec-lam/x-1.html']);
  });

  it('rejects non-detail hrefs', () => {
    const html = `
      <a href="/about">A</a>
      <a href="/viec-lam/x-no-digits.html">B</a>
      <a href="/viec-lam/x-1.html">C</a>
    `;
    expect(extractTopcvDetailUrls(html)).toEqual(['https://www.topcv.vn/viec-lam/x-1.html']);
  });
});

describe('vnw — normalizeVnwSlug', () => {
  it.each([
    ['viec-lam-cong-nghe-thong-tin-k1', 'viec-lam-cong-nghe-thong-tin-k1'],
    ['cong-nghe-thong-tin-k1', 'viec-lam-cong-nghe-thong-tin-k1'],
    ['/cong-nghe-thong-tin-k1', 'viec-lam-cong-nghe-thong-tin-k1'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeVnwSlug(input)).toBe(expected);
  });
});

describe('vnw — extractVnwDetailUrls', () => {
  it('captures -{id}-jv suffix variants', () => {
    const html = `
      <a href="https://www.vietnamworks.com/senior-dev-12345-jv">A</a>
      <a href='/qa-tester-99999-jv'>B</a>
    `;
    expect(extractVnwDetailUrls(html).sort()).toEqual([
      'https://www.vietnamworks.com/qa-tester-99999-jv',
      'https://www.vietnamworks.com/senior-dev-12345-jv',
    ]);
  });

  it('does NOT capture similar but non-jv hrefs', () => {
    const html = `<a href="/senior-dev-12345-job">A</a>`;
    expect(extractVnwDetailUrls(html)).toEqual([]);
  });
});

describe('vnw — extractVnwNextDataUrls', () => {
  it('walks __NEXT_DATA__ payload and pulls -jv hits', () => {
    const payload = {
      props: {
        pageProps: {
          jobs: [
            { alias: '/dev-1-jv', title: 'Dev' },
            { alias: '/qa-2-jv', title: 'QA' },
            { unrelated: 'string-without-suffix' },
          ],
        },
      },
    };
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>`;
    expect(extractVnwNextDataUrls(html).sort()).toEqual([
      'https://www.vietnamworks.com/dev-1-jv',
      'https://www.vietnamworks.com/qa-2-jv',
    ]);
  });

  it('returns [] when __NEXT_DATA__ missing', () => {
    expect(extractVnwNextDataUrls('<html></html>')).toEqual([]);
  });

  it('returns [] on invalid JSON', () => {
    expect(extractVnwNextDataUrls('<script id="__NEXT_DATA__">not-json</script>')).toEqual([]);
  });
});

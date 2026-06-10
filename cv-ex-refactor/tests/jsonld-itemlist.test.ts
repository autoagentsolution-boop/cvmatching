import { describe, it, expect } from 'vitest';
import {
  extractItemListEntries,
  extractItemListUrls,
} from '@/lib/scrape/jsonld-itemlist';

function ldScript(payload: object): string {
  return `<script type="application/ld+json">${JSON.stringify(payload)}</script>`;
}

describe('extractItemListEntries / extractItemListUrls', () => {
  it('extracts {url, name} from direct ItemList shape (ITviec-style)', () => {
    const html = ldScript({
      '@type': 'ItemList',
      itemListElement: [
        { url: 'https://itviec.com/it-jobs/senior-engineer-1', name: 'Senior Data Engineer' },
        { url: 'https://itviec.com/it-jobs/junior-2', name: 'Junior Backend Developer' },
      ],
    });
    const entries = extractItemListEntries(html);
    expect(entries).toEqual([
      { url: 'https://itviec.com/it-jobs/senior-engineer-1', name: 'Senior Data Engineer' },
      { url: 'https://itviec.com/it-jobs/junior-2', name: 'Junior Backend Developer' },
    ]);
  });

  it('extracts {url, name} from nested ItemList shape (TopCV-style)', () => {
    const html = ldScript({
      '@type': 'SearchResultsPage',
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, item: { url: 'https://topcv.vn/job/a', name: 'Lead Engineer' } },
        ],
      },
    });
    const entries = extractItemListEntries(html);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ url: 'https://topcv.vn/job/a', name: 'Lead Engineer' });
  });

  it('emits {url} (no name) when JSON-LD does not carry a name', () => {
    const html = ldScript({
      '@type': 'ItemList',
      itemListElement: [{ url: 'https://example.com/job/x' }],
    });
    const entries = extractItemListEntries(html);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.url).toBe('https://example.com/job/x');
    expect(entries[0]!.name).toBeUndefined();
  });

  it('prefers outer name when both outer and item.name are present', () => {
    const html = ldScript({
      '@type': 'ItemList',
      itemListElement: [
        {
          name: 'Outer Senior Engineer',
          item: { url: 'https://x.com/j', name: 'Inner fallback' },
        },
      ],
    });
    expect(extractItemListEntries(html)[0]!.name).toBe('Outer Senior Engineer');
  });

  it('falls back to item.name when outer name absent', () => {
    const html = ldScript({
      '@type': 'ItemList',
      itemListElement: [
        { item: { url: 'https://x.com/j', name: 'Inner Senior Engineer' } },
      ],
    });
    expect(extractItemListEntries(html)[0]!.name).toBe('Inner Senior Engineer');
  });

  it('legacy extractItemListUrls returns just the URLs (backwards compat)', () => {
    const html = ldScript({
      '@type': 'ItemList',
      itemListElement: [
        { url: 'https://a.com/1', name: 'A' },
        { url: 'https://b.com/2', name: 'B' },
      ],
    });
    expect(extractItemListUrls(html)).toEqual(['https://a.com/1', 'https://b.com/2']);
  });

  it('returns [] on malformed JSON inside the script tag (no throw)', () => {
    const html = '<script type="application/ld+json">{ broken json</script>';
    expect(extractItemListEntries(html)).toEqual([]);
  });

  it('returns [] when there is no ItemList in the payload', () => {
    const html = ldScript({ '@type': 'Organization', name: 'Not a list' });
    expect(extractItemListEntries(html)).toEqual([]);
  });
});

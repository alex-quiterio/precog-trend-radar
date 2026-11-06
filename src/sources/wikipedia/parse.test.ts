import { describe, expect, it } from 'vitest';
import pageviews from './fixtures/pageviews.json';
import titleQuery from './fixtures/title-query.json';
import titleMissing from './fixtures/title-missing.json';
import opensearch from './fixtures/opensearch.json';
import { parseOpenSearch, parsePageviews, parseTitleQuery } from './parse';

describe('Wikipedia replies', () => {
  it('reads daily pageviews as ISO days', () => {
    const points = parsePageviews(pageviews);
    expect(points).toHaveLength(5);
    expect(points[0]).toEqual({ t: '2026-10-20T00:00:00Z', value: 3419 });
  });
  it('skips days without a count, and replies without items', () => {
    expect(parsePageviews({ items: [{ timestamp: '2026102000' }, { timestamp: 'x', views: 3 }] })).toEqual([]);
    expect(parsePageviews({})).toEqual([]);
  });
  it('finds the article a title lands on, and nothing for a missing one', () => {
    expect(parseTitleQuery(titleQuery)).toBe('Peak oil');
    expect(parseTitleQuery(titleMissing)).toBeNull();
  });
  it('reads the first opensearch suggestion', () => {
    expect(parseOpenSearch(opensearch)).toBe('Degrowth');
    expect(parseOpenSearch(['q', []])).toBeNull();
    expect(() => parseOpenSearch({})).toThrow(/unexpected format/);
  });
});

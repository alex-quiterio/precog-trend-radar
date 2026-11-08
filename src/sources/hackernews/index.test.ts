// The Hacker News trend: stories per day over 45 days, from one request when it can, kept per day.
import { describe, expect, it } from 'vitest';
import { DAY } from '@core/config';
import { fakeFetch } from '@sources/fake-fetch';
import { ADAPTERS, utcDay } from '@sources/registry';
import './index';

const signal = new AbortController().signal;
const query = (q: string, lang = 'en') => ({ name: q, wiki: null, q, lang, country: null });
/** Stories posted `ago` days back (one per entry), as Algolia lists them; `total` is what it says it found. */
const hits = (ago: number[], total = ago.length) => ({
  hits: ago.map((d, i) => ({ objectID: String(i), created_at_i: Math.floor((utcDay() - d * DAY + 3600e3) / 1000) })),
  nbHits: total,
});
const net = fakeFetch(() => hits([]));
const hn = () => ADAPTERS.hn;

describe('Hacker News stories per day', () => {
  it('skips topics that are not in English', async () => {
    const r = await hn().fetch('Habitação', { signal, query: query('Habitação', 'pt') });
    expect(r.skip).toBe('Hacker News is English-only');
    expect(net.urls).toEqual([]);
  });
  it('counts 45 days from one request when every story fits in it', async () => {
    net.custom = () => hits([1, 1, 2, 10]);
    const r = await hn().fetch('Peak oil', { signal, query: query('peak oil') });
    expect(net.urls).toHaveLength(1);
    expect(decodeURIComponent(net.urls[0])).toContain('query="peak oil"');
    expect(r.points).toHaveLength(45);
    const at = (d: number) => r.points.find(p => Date.parse(String(p.t)) === utcDay() - d * DAY)?.value;
    expect([at(1), at(2), at(10), at(3)]).toEqual([2, 1, 1, 0]);
  });
  it('asks day by day when there are too many stories for one request', async () => {
    net.custom = url => (url.searchParams.get('hitsPerPage') === '1000' ? hits([1], 5000) : { hits: [], nbHits: 7 });
    const r = await hn().fetch('AI', { signal, query: query('AI') });
    expect(net.urls).toHaveLength(1 + 45);
    expect(r.points.every(p => p.value === 7)).toBe(true);
  });
  it('keeps the days it counted, and asks again only for the last two', async () => {
    net.custom = () => hits([5]);
    await hn().fetch('Degrowth', { signal, query: query('degrowth') });
    net.urls.length = 0;
    net.custom = () => ({ hits: [], nbHits: 4 });
    const r = await hn().fetch('Degrowth', { signal, query: query('degrowth') });
    expect(net.urls.length).toBeLessThanOrEqual(3);
    expect(net.urls.every(u => u.includes('hitsPerPage=0'))).toBe(true);
    expect(r.points.find(p => Date.parse(String(p.t)) === utcDay() - 5 * DAY)?.value).toBe(1);
  });
});

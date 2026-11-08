// The Guardian trend: articles per day over 45 days, with the newest kept to read; one call a second at most.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY } from '@core/config';
import { fakeFetch } from '@sources/fake-fetch';
import { ADAPTERS, HttpError, utcDay } from '@sources/registry';
import { guardianArticles, guardianKey, setGuardianKey } from './index';

const signal = new AbortController().signal;
const query = (q: string, lang = 'en') => ({ name: q, wiki: null, q, lang, country: null });
/** One search page: an article for each `ago` (days back, newest first), plus a live blog yesterday. */
const page = (ago: number[]) => ({
  response: {
    status: 'ok',
    pages: 1,
    results: [
      ...ago.map((d, i) => ({
        id: `world/${i}`,
        type: 'article',
        sectionName: 'World news',
        webPublicationDate: new Date(utcDay() - d * DAY + 3600e3).toISOString(),
        webTitle: `Story ${i}`,
        webUrl: `https://www.theguardian.com/world/${i}`,
      })),
      {
        id: 'world/live',
        type: 'liveblog',
        sectionName: 'World news',
        webPublicationDate: new Date(utcDay() - DAY).toISOString(),
        webTitle: 'Live',
        webUrl: 'https://www.theguardian.com/world/live',
      },
    ],
  },
});
const net = fakeFetch(() => page([0, 0, 1, 30]));
const guardian = () => ADAPTERS.guardian;

// The Guardian allows one call a second: move the clock on between tests, so none waits for the last.
let clock = Date.UTC(2026, 10, 8, 12);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime((clock += 10e3));
});
afterEach(() => vi.useRealTimers());

describe('the key', () => {
  it('is kept trimmed, and the trend skips topics without one', async () => {
    expect(guardianKey()).toBe('');
    const r = await guardian().fetch('Gaza', { signal, query: query('Gaza') });
    expect(r.skip).toBe('add a Guardian API key to include news');
    setGuardianKey('  k-1 ');
    expect(guardianKey()).toBe('k-1');
  });
});

describe('articles per day', () => {
  beforeEach(() => setGuardianKey('test-key'));
  it('skips topics that are not in English', async () => {
    const r = await guardian().fetch('Habitação', { signal, query: query('Habitação', 'pt') });
    expect(r.skip).toBe('The Guardian is English-only');
  });
  it('counts 45 days of articles, and keeps the newest articles (not live blogs) to read', async () => {
    const r = await guardian().fetch('Peak oil', { signal, query: query('peak oil') });
    expect(net.urls).toHaveLength(1);
    expect(decodeURIComponent(net.urls[0])).toContain('q="peak oil"');
    expect(r.points).toHaveLength(45);
    expect(r.points.at(-1)!.value).toBe(2); // today
    expect(r.points.at(-2)!.value).toBe(2); // yesterday: an article and the live blog
    expect(r.points.reduce((a, p) => a + p.value, 0)).toBe(5);
    expect(guardianArticles('peak oil').map(a => a.title)).toEqual(['Story 0', 'Story 1', 'Story 2', 'Story 3']);
  });
  it('reads a topic once a day', async () => {
    await guardian().fetch('NATO', { signal, query: query('NATO') });
    await guardian().fetch('NATO', { signal, query: query('NATO') });
    expect(net.urls).toHaveLength(1);
  });
  it('lists no articles for a topic not fetched today', () => {
    expect(guardianArticles('never asked')).toEqual([]);
  });
  it.each([
    [new HttpError(401), 'The Guardian rejected the API key'],
    [new HttpError(429), 'Guardian daily limit reached'],
  ])('says what went wrong: %s', async (_err, message) => {
    const status = (_err as HttpError).status;
    vi.stubGlobal('fetch', async () => ({ ok: false, status, json: async () => null }));
    await expect(guardian().fetch('Inflation', { signal, query: query('inflation') })).rejects.toThrow(message);
  });
  it('blames the key when the browser blocks the reply', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(guardian().fetch('Tariffs', { signal, query: query('tariffs') })).rejects.toThrow(
      'The Guardian refused the request (most likely the key)',
    );
  });
});

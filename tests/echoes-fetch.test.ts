// Fetching today's echoes with every request answered from saved replies, with and without a Guardian key.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryBackend, useBackend } from '@core/storage';
import { fetchEchoSignals, wikiPages, wikiStyle } from '@sources/echoes';
import { setGuardianKey } from '@sources/guardian';
import feed from '@sources/echoes/fixtures/featured-feed.json';
import hn from '@sources/echoes/fixtures/hn-front-page.json';
import manifold from '@sources/echoes/fixtures/manifold-trending.json';
import guardianFront from '@sources/echoes/fixtures/guardian-front.json';
import pages from '@sources/echoes/fixtures/wiki-pages.json';
import searchCop31 from '@sources/echoes/fixtures/wiki-search-cop31.json';
import searched from '@sources/echoes/fixtures/wiki-pages-searched.json';

const urls: string[] = [];
function answer(url: string): unknown {
  const u = new URL(url);
  urls.push(url);
  if (u.pathname.includes('/feed/featured/')) return feed;
  if (u.hostname === 'hn.algolia.com') return hn;
  if (u.hostname === 'api.manifold.markets') return manifold;
  if (u.hostname === 'content.guardianapis.com') return guardianFront;
  if (u.searchParams.get('action') === 'opensearch')
    return u.searchParams.get('search') === 'Cop31' ? searchCop31 : [u.searchParams.get('search'), [], [], []];
  if (u.searchParams.get('action') === 'query')
    return (u.searchParams.get('titles') || '').startsWith('COP31') ? searched : pages;
  throw new Error('unexpected ' + url);
}
beforeEach(() => {
  urls.length = 0;
  useBackend(memoryBackend());
  vi.stubGlobal('fetch', async (url: string) => ({ ok: true, status: 200, json: async () => answer(url) }));
});
afterEach(() => vi.unstubAllGlobals());

describe('fetching the echoes', () => {
  it('without a Guardian key: Wikipedia, Hacker News and Manifold only', async () => {
    const s = await fetchEchoSignals(new AbortController().signal);
    expect(s.feed.news).toHaveLength(5);
    expect(s.elsewhere.hn).toHaveLength(30);
    expect(s.guardian).toBeUndefined();
    expect(urls.some(u => u.includes('guardianapis'))).toBe(false);
  });
  it('with a key: the Guardian front’s topics, each with its Wikipedia article, and its headlines as echoes', async () => {
    setGuardianKey('k');
    const s = await fetchEchoSignals(new AbortController().signal);
    const byTag = Object.fromEntries((s.guardian ?? []).map(g => [g.article.title, g.picks + g.viewed]));
    expect(byTag).toMatchObject({
      Binance: 2,
      '2026 United States elections': 2, // "US midterm elections 2026", rewritten Wikipedia's way
      'Gaza war': 2, // "Israel-Gaza war", by redirect
      'United Nations Climate Change Conference': 2, // "Cop31", found by search
    });
    expect(s.elsewhere.guardian).toContain('How hackers drained Binance');
  });
});

describe('matching names to Wikipedia', () => {
  it('rewrites a name ending in a year the way Wikipedia titles it', () => {
    expect(wikiStyle('US midterm elections 2026')).toBe('2026 United States midterm elections');
    expect(wikiStyle('Ukraine')).toBeNull();
  });
  it('never takes a search result from another year', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      const u = new URL(url);
      const body =
        u.searchParams.get('action') === 'opensearch'
          ? ['Floods 2026', ['Floods 2006'], [''], ['']]
          : { query: { pages: { '-1': { title: 'x', missing: '' } } } };
      return { ok: true, status: 200, json: async () => body };
    });
    expect((await wikiPages(['Floods 2026'], new AbortController().signal)).size).toBe(0);
  });
});

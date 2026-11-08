// The Wikipedia trend: a topic's article, found once and kept, and 60 days of its pageviews in the lens language.
import { describe, expect, it } from 'vitest';
import { fakeFetch, fixture } from '@sources/fake-fetch';
import { ADAPTERS } from '@sources/registry';
import { resolveWikiTitle } from './index';

const signal = new AbortController().signal;
const net = fakeFetch(url => {
  if (url.searchParams.get('action') === 'query') return fixture('wikipedia', 'title-query.json');
  if (url.searchParams.get('action') === 'opensearch') return fixture('wikipedia', 'opensearch.json');
  if (url.hostname === 'wikimedia.org') return fixture('wikipedia', 'pageviews.json');
  throw new Error('unexpected');
});
const saved = JSON.parse(fixture('wikipedia', 'title-query.json'));
const savedTitle: string = Object.values(saved.query.pages as Record<string, { title: string }>)[0].title;

describe('resolveWikiTitle', () => {
  it('finds the article, following redirects, and keeps it', async () => {
    expect(await resolveWikiTitle('degrowth', signal)).toBe(savedTitle);
    expect(await resolveWikiTitle('degrowth', signal)).toBe(savedTitle);
    expect(net.urls).toHaveLength(1);
    expect(net.urls[0]).toMatch(/^https:\/\/en\.wikipedia\.org\/.*redirects=1/);
  });
  it('searches when there is no article by that exact name', async () => {
    net.custom = url =>
      url.searchParams.get('action') === 'query' ? fixture('wikipedia', 'title-missing.json') : undefined;
    expect(await resolveWikiTitle('degrowht', signal, 'pt')).toBe(
      JSON.parse(fixture('wikipedia', 'opensearch.json'))[1][0],
    );
    expect(net.urls.map(u => new URL(u).hostname)).toEqual(['pt.wikipedia.org', 'pt.wikipedia.org']);
  });
  it('refuses when nothing matches, or the closest article is about a person', async () => {
    net.custom = url =>
      url.searchParams.get('action') === 'query' ? fixture('wikipedia', 'title-missing.json') : ['x', [], [], []];
    await expect(resolveWikiTitle('qwzx', signal)).rejects.toThrow('no matching Wikipedia article');
    net.custom = url =>
      url.searchParams.get('action') === 'query' ? { query: { pages: { 1: { title: 'Elon Musk' } } } } : undefined;
    await expect(resolveWikiTitle('musk', signal)).rejects.toThrow(/about a person/);
  });
});

describe('Wikipedia pageviews', () => {
  it('reads 60 days of the article’s views in the lens language', async () => {
    const r = await ADAPTERS.wikipedia.fetch('Degrowth', {
      signal,
      query: { name: 'Degrowth', wiki: 'Degrowth', q: 'degrowth', lang: 'nl', country: null },
    });
    const views = net.urls.find(u => u.includes('wikimedia.org'))!;
    expect(views).toContain('/per-article/nl.wikipedia/all-access/user/');
    const [from, to] = views.split('/daily/')[1].split('/');
    expect(
      (Date.parse(`${to.slice(0, 4)}-${to.slice(4, 6)}-${to.slice(6)}`) -
        Date.parse(`${from.slice(0, 4)}-${from.slice(4, 6)}-${from.slice(6)}`)) /
        864e5,
    ).toBe(59);
    expect(r.meta).toEqual({ wikiTitle: savedTitle, wikiLang: 'nl' });
    expect(r.points.length).toBeGreaterThan(0);
  });
});

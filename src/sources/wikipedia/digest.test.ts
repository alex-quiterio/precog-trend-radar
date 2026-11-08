// Wikipedia stories and the digest: what each topic's story says, where it comes from, and how it loads.
import { beforeEach, describe, expect, it } from 'vitest';
import feed from './fixtures/featured-news.json';
import summary from './fixtures/summary.json';
import { lead, parseNewsStories, parseSummary, plainText } from './parse';
import { memoryBackend, useBackend } from '@core/storage';
import { utcDay } from '@sources/registry';
import type { Entry } from '@/types';
import type { ReadingItem } from '@sources/reading';
import { fakeFetch } from '@sources/fake-fetch';
import { createAppStore } from '@/state';
import {
  type DigestData,
  digestItems,
  guardianLatest,
  latestPosts,
  loadDigest,
  postFor,
  storyFor,
  weekChange,
} from './digest';

const DAY = 86400e3;

describe('Wikipedia stories', () => {
  it('reads "In the news" as plain sentences with their day and links', () => {
    const [first, , third] = parseNewsStories(feed);
    expect(first.text).toBe(
      'In the United States, the Democratic Party wins a majority in both the House of Representatives and the Senate in the midterm elections.',
    );
    expect(first.day).toBe('Nov 3');
    expect(first.links[0]).toBe('2026 United States elections');
    expect(third.links).toContain('2026 Polish Constitutional Tribunal crisis');
    expect(third.text).not.toMatch(/[<>]/);
  });
  it('drops tags, entities and "(pictured)"', () => {
    expect(plainText('<!--Nov 1-->A <b>ship</b> (pictured) sinks &amp; <i>burns</i>.')).toBe('A ship sinks & burns.');
  });
  it('reads a page summary', () => {
    const s = parseSummary(summary);
    expect(s.title).toBe('2026 Binance hack');
    expect(s.description).toBe('Cryptocurrency theft');
    expect(s.extract).toMatch(/^On 29 October 2026/);
    expect(s.url).toBe('https://en.wikipedia.org/wiki/2026_Binance_hack');
  });
  it('refuses a disambiguation page or a reply without an extract', () => {
    expect(() => parseSummary({ ...summary, type: 'disambiguation' })).toThrow(/disambiguation/);
    expect(() => parseSummary({ title: 'X' })).toThrow(/unexpected format/);
  });
  it('keeps whole sentences of a lead, up to a length', () => {
    const s = parseSummary(summary);
    const l = lead(s.extract, 240);
    expect(l.length).toBeLessThanOrEqual(240);
    expect(l).toMatch(
      /Binance, a cryptocurrency exchange, allegedly by the North Korea-linked hacking group TraderTraitor\.$/,
    );
    expect(lead('One sentence without an end and much too long for the limit', 20)).toBe('One sentence…');
  });
  it('finds the story about a topic by its article, or by name', () => {
    const stories = parseNewsStories(feed);
    expect(storyFor(stories, '2026 United States elections', 'United States elections')).toBe(stories[0]);
    expect(storyFor(stories, 'Constitutional Tribunal (Poland)', 'x')).toBe(stories[2]);
    expect(storyFor(stories, 'Nothing', 'Senate')).toBe(stories[0]);
    expect(storyFor(stories, 'Nothing', 'Gaza war')).toBeNull();
  });
  it('measures a week of attention', () => {
    const t0 = Date.UTC(2026, 10, 1);
    const series = [...Array(10).keys()].map(i => ({ t: t0 + i * DAY, value: 100 + i * 10 }));
    expect(weekChange(series)).toBeCloseTo(((190 - 120) / 120) * 100);
    expect(weekChange(series.slice(-3))).toBeNull();
    expect(weekChange([])).toBeNull();
  });
  it('tells fresh headlines, then the news, and never passes an article lead off as a story', () => {
    const now = Date.now();
    // A Guardian article on "Gaza war" from an hour ago, as the trend fetch caches it.
    useBackend(
      memoryBackend({
        'precog.guardian.v2."gaza war"': {
          day: utcDay(now),
          articles: [
            { id: 'g1', title: 'Ceasefire talks resume', url: 'https://gu.com/g1', section: 'World', t: now - 3600e3 },
          ],
        },
      }),
    );
    const entry = (key: string, name: string, values: number[]) =>
      ({
        key,
        name,
        def: { name, slot: 0 },
        lang: 'en',
        country: null,
        meta: {},
        liveSeries: values.map((value, i) => ({ t: now - (values.length - 1 - i) * DAY, value })),
      }) as unknown as Entry;
    const sum = parseSummary(summary);
    const entries = [
      entry('a', 'Binance hack', [100, 100, 100, 100, 100, 100, 100, 300]),
      entry('b', 'Gaza war', [100, 100, 100, 100, 100, 100, 100, 90]),
      entry('c', 'Quiet thing', [100, 100, 100, 100, 100, 100, 100, 500]),
    ];
    const data: DigestData = new Map([
      ['c', { key: 'c', summary: { ...sum, description: 'A quiet thing' }, news: null }],
      ['b', { key: 'b', summary: { ...sum, description: 'Armed conflict' }, news: null }],
      ['a', { key: 'a', summary: sum, news: parseNewsStories(feed)[0] }],
    ]);
    const items = digestItems(entries, data, now);
    expect(items.map(d => [d.key, d.kind])).toEqual([
      ['b', 'headline'],
      ['a', 'news'],
      ['c', 'quiet'],
    ]);
    expect(items[0]).toMatchObject({
      text: 'Ceasefire talks resume',
      url: 'https://gu.com/g1',
      source: 'The Guardian',
      also: null,
    });
    expect(items[1].source).toBe('In the news · Nov 3');
    expect(items[1].week).toBeCloseTo(200);
    expect(items[2].text).toBe('A quiet thing');
  });

  it("on a scoped channel, tells stories from its own sites only, in Portuguese too, never the Guardian's", () => {
    const now = Date.now();
    // A Guardian article on "wildfire" from an hour ago: a scoped channel leaves it out.
    useBackend(
      memoryBackend({
        'precog.guardian.v2.wildfire': {
          day: utcDay(now),
          articles: [
            { id: 'g2', title: 'Fires in California', url: 'https://gu.com/g2', section: 'US', t: now - 3600e3 },
          ],
        },
      }),
    );
    const post = (title: string, hoursAgo: number, site = 'Agroportal'): ReadingItem => ({
      id: title,
      origin: 'https://www.agroportal.pt',
      site,
      kind: 'News',
      num: null,
      title,
      url: `https://www.agroportal.pt/${encodeURIComponent(title)}`,
      t: now - hoursAgo * 3600e3,
      text: '',
    });
    const fires = {
      key: 'portugal::wildfires',
      lensId: 'portugal',
      name: 'Wildfires',
      def: { name: 'Wildfires', slot: 0, wiki: 'Wildfire', q: 'wildfire' },
      lang: 'en',
      country: null,
      meta: {},
      liveSeries: [],
    } as unknown as Entry;
    const posts = [
      post('Incêndios: Douro propõe 52 projetos', 20),
      post('Incêndios: balanço de 2025', 60), // older than two days
      post('Apoios à agricultura batem recorde', 1), // names it nowhere in the title
      post('Proteção Civil reforça meios contra fogos florestais', 5, 'Green Savers'),
    ];
    expect(postFor(posts, fires, now)?.title).toBe('Proteção Civil reforça meios contra fogos florestais');
    expect(postFor(posts.slice(1, 3), fires, now)).toBeNull();
    expect(postFor(posts.slice(1, 3), fires, now, 30)?.title).toBe('Incêndios: balanço de 2025'); // a monthly window

    const sum = parseSummary(summary);
    const data: DigestData = new Map([[fires.key, { key: fires.key, summary: sum, news: null, post: posts[0] }]]);
    expect(digestItems([fires], data, now, { days: 2 })[0]).toMatchObject({
      kind: 'headline',
      text: 'Incêndios: Douro propõe 52 projetos',
      source: 'Agroportal',
    });
    // Without a scope it's the world's: the Guardian's headline, and the site's post isn't read.
    expect(digestItems([fires], data, now)[0]).toMatchObject({ source: 'The Guardian', text: 'Fires in California' });
    // A post older than the window is no story.
    const stale = new Map([[fires.key, { key: fires.key, summary: sum, news: null, post: posts[1] }]]);
    expect(digestItems([fires], stale, now, { days: 2 })[0].kind).toBe('quiet');
  });
  it('lists the newest headlines, leaving out the ones already told as a topic’s story', () => {
    const now = Date.now();
    const item = (title: string, hoursAgo: number): ReadingItem => ({
      id: title,
      origin: 'https://www.dutchnews.nl',
      site: 'DutchNews.nl',
      kind: 'News',
      num: null,
      title,
      url: `https://www.dutchnews.nl/${title}`,
      t: now - hoursAgo * 3600e3,
      text: '',
    });
    const posts = [item('a', 1), item('b', 3), item('c', 2), item('old', 72), item('d', 4), item('e', 5)];
    const told = new Set(['https://www.dutchnews.nl/c']);
    expect(latestPosts(posts, told, now).map(p => p.title)).toEqual(['a', 'b', 'd', 'e']);
  });
  it('with a Guardian key, leads a story in the news with its fresh headline and lists its newest below', () => {
    const now = Date.now();
    const art = (id: string, title: string, hoursAgo: number) => ({
      id,
      title,
      url: `https://gu.com/${id}`,
      section: 'World',
      t: now - hoursAgo * 3600e3,
    });
    useBackend(
      memoryBackend({
        'precog.guardian.v2."binance hack"': {
          day: utcDay(now),
          articles: [art('b1', 'Binance hackers launder the loot', 2), art('b0', 'Older take', 70)],
        },
        'precog.guardian.v2."gaza war"': {
          day: utcDay(now),
          articles: [art('g1', 'Ceasefire talks resume', 1), art('b1', 'Binance hackers launder the loot', 2)],
        },
      }),
    );
    const entry = (key: string, name: string) =>
      ({ key, name, def: { name, slot: 0 }, lang: 'en', country: null, meta: {}, liveSeries: [] }) as unknown as Entry;
    const entries = [entry('a', 'Binance hack'), entry('b', 'Gaza war')];
    const sum = parseSummary(summary);
    const data: DigestData = new Map([['a', { key: 'a', summary: sum, news: parseNewsStories(feed)[0] }]]);
    const [lead] = digestItems(entries, data, now);
    // Hours old beats "In the news" (days old): the Guardian's headline leads, the news is its second line.
    expect(lead).toMatchObject({ kind: 'headline', source: 'The Guardian', text: 'Binance hackers launder the loot' });
    expect(lead.also).toMatchObject({ source: 'In the news · Nov 3', t: null });
    // Newest first, each once, the old one out, and what a story already tells left out.
    expect(guardianLatest(entries, new Set(), now).map(a => a.title)).toEqual([
      'Ceasefire talks resume',
      'Binance hackers launder the loot',
    ]);
    expect(guardianLatest(entries, new Set(['https://gu.com/b1']), now).map(a => a.title)).toEqual([
      'Ceasefire talks resume',
    ]);
    // Without a key nothing is cached, so there is nothing to add.
    useBackend(memoryBackend({}));
    expect(digestItems(entries, data, now)[0]).toMatchObject({ kind: 'news', source: 'In the news · Nov 3' });
    expect(guardianLatest(entries, new Set(), now)).toEqual([]);
  });
});

describe('loadDigest', () => {
  const article = (title: string) => ({
    type: 'standard',
    title,
    description: `About ${title}`,
    extract: `${title} is a subject. It has a second sentence.`,
  });
  const net = fakeFetch(url => {
    if (url.pathname.includes('/feed/featured/'))
      return { news: [{ story: '<!--Nov 8-->Leaders meet at the <a href="./NATO" title="NATO">NATO</a> summit.' }] };
    if (url.searchParams.get('action') === 'query') {
      const t = url.searchParams.get('titles')!;
      return t === 'Gaza war'
        ? { query: { pages: { '-1': { missing: '' } } } }
        : { query: { pages: { 1: { title: t } } } };
    }
    if (url.searchParams.get('action') === 'opensearch') return ['', [], [], []];
    if (url.pathname.includes('/page/summary/'))
      return article(decodeURIComponent(url.pathname.split('/').pop()!).replace(/_/g, ' '));
    throw new Error('unexpected ' + url);
  });
  const signal = new AbortController().signal;
  let world: Entry[] = [];
  beforeEach(() => {
    const app = createAppStore();
    app.loadLenses();
    world = app.entriesOf(app.lensById('world'));
  });
  const byName = (name: string) => world.find(E => E.name === name)!;

  it('gives each topic its article and, in English, the story in the news about it', async () => {
    const shown: number[] = [];
    const d = await loadDigest([byName('NATO'), byName('Inflation')], signal, m => shown.push(m.size));
    expect(d.get(byName('NATO').key)).toMatchObject({ summary: { title: 'NATO' }, news: { day: 'Nov 8' }, post: null });
    expect(d.get(byName('Inflation').key)?.news).toBeNull();
    expect(shown).toEqual([1, 2]); // shown as topics arrive
  });
  it('reads the feed and each summary once a day', async () => {
    await loadDigest([byName('NATO')], signal);
    const asked = net.urls.length;
    await loadDigest([byName('NATO')], signal);
    expect(net.urls).toHaveLength(asked); // title, feed and summary all kept
  });
  it('uses the article the trend already found', async () => {
    const E = byName('NATO');
    E.meta.wikiTitle = 'North Atlantic Treaty Organization';
    const d = await loadDigest([E], signal);
    expect(d.get(E.key)?.summary.title).toBe('North Atlantic Treaty Organization');
    expect(net.urls.some(u => u.includes('action=query'))).toBe(false);
  });
  it('leaves out a topic without an article, and fails only when every topic does', async () => {
    const gaza = byName('Gaza war');
    const d = await loadDigest([gaza, byName('NATO')], signal);
    expect([...d.keys()]).toEqual([byName('NATO').key]);
    await expect(loadDigest([gaza], signal)).rejects.toThrow('no Wikipedia article for Gaza war');
  });
  it('on a scoped channel, reads its sites’ posts instead of the news', async () => {
    const site = { url: 'https://site.example', name: 'Site', types: [['posts', 'Post']] as [string, string][] };
    net.custom = url =>
      url.hostname === 'site.example'
        ? [
            {
              id: 1,
              date_gmt: new Date(Date.now() - 3600e3).toISOString().slice(0, 19),
              link: 'https://site.example/nato',
              title: { rendered: 'NATO summit opens' },
              content: { rendered: '' },
            },
          ]
        : undefined;
    const d = await loadDigest([byName('NATO')], signal, () => {}, { sites: [site], days: 2 });
    expect(d.get(byName('NATO').key)).toMatchObject({ news: null, post: { title: 'NATO summit opens', site: 'Site' } });
    expect(net.urls.some(u => u.includes('/feed/featured/'))).toBe(false);
  });
});

// The Hacker News stream: stories from the last 48 h naming a topic, ranked by engagement per hour.
import { beforeEach, describe, expect, it } from 'vitest';
import { memoryBackend, useBackend } from '@core/storage';
import { fakeFetch } from '@sources/fake-fetch';
import { streamById, type StreamContext } from '@sources/streams';
import { createAppStore } from '@/state';
import type { Entry } from '@/types';
import { hnStories, observe, type HNData, type HNStory } from './stream';

const HOUR = 3600e3;
const NOW = Date.now();
const signal = new AbortController().signal;
let world: Entry[] = [];
beforeEach(() => {
  useBackend(memoryBackend());
  const app = createAppStore();
  app.loadLenses();
  world = app.entriesOf(app.lensById('world'));
});
const ctx = (entries: Entry[], scope: 'lens' | 'topic' = 'lens'): StreamContext => ({
  entries,
  scopeKeys: new Set(entries.map(E => E.key)),
  scope,
  now: NOW,
  keys: { guardian: false },
});
const byName = (name: string) => world.find(E => E.name === name)!;
const hn = () => streamById('hn')!;

/** Stories Algolia found for a search: `title`, posted `h` hours ago, with points and comments. */
const hit = (id: string, title: string, h: number, points = 10, comments = 2, url = `https://example.org/${id}`) => ({
  objectID: id,
  title,
  url,
  points,
  num_comments: comments,
  created_at_i: Math.floor((NOW - h * HOUR) / 1000),
});
const net = fakeFetch(url => {
  const q = url.searchParams.get('query');
  if (q === '"Gaza"' || q === 'Gaza')
    return {
      hits: [
        hit('1', 'Gaza ceasefire talks', 2, 50, 30),
        hit('2', 'Unrelated: ga za', 3),
        hit('3', 'AI and Gaza', 4, 5, 1),
      ],
    };
  if (q === 'AI') return { hits: [hit('3', 'AI and Gaza', 4, 5, 1), hit('4', 'Ask HN: AI', 1, 2, 0, '')] };
  return { hits: [] };
});

describe('loading', () => {
  it('keeps stories whose title names the topic, merging a story found for two topics', async () => {
    const data = (await hn().load(
      ctx([byName('Gaza war'), byName('Artificial intelligence')]),
      signal,
      () => {},
    )) as HNData;
    const stories = hnStories(data);
    expect(stories.map(s => s.title).sort()).toEqual(['AI and Gaza', 'Ask HN: AI', 'Gaza ceasefire talks']);
    const both = stories.find(s => s.title === 'AI and Gaza')!;
    expect([...both.topics].sort()).toEqual([byName('Gaza war').key, byName('Artificial intelligence').key].sort());
    expect(both.domain).toBe('example.org');
  });
  it('links a text post to its discussion', async () => {
    const data = (await hn().load(ctx([byName('Artificial intelligence')]), signal, () => {})) as HNData;
    const ask = hnStories(data).find(s => s.title === 'Ask HN: AI')!;
    expect(ask.url).toBe('https://news.ycombinator.com/item?id=4');
    expect(ask.domain).toBe('news.ycombinator.com');
  });
  it('averages engagement since posting until it can measure it between visits', async () => {
    const data = (await hn().load(ctx([byName('Gaza war')]), signal, () => {})) as HNData;
    const s = hnStories(data).find(x => x.title === 'Gaza ceasefire talks')!;
    expect(s.measured).toBe(false);
    expect(s.vel).toBeCloseTo(80 / 2, 0);
    expect(s.pred24!).toBeGreaterThan(80);
  });
  it('skips topics that are not in English', async () => {
    const pt = { ...byName('Gaza war'), lang: 'pt' } as Entry;
    await hn().load(ctx([pt]), signal, () => {});
    expect(net.urls).toEqual([]);
  });
});

describe('observe', () => {
  it('measures engagement per hour between two visits at least five minutes apart', () => {
    const t0 = Date.now();
    expect(observe('hn:x', 10)).toBeNull();
    const realNow = Date.now;
    Date.now = () => t0 + 30 * 60e3;
    try {
      expect(observe('hn:x', 30)).toBeCloseTo(40);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('the view', () => {
  const story = (id: string, topic: string, vel: number, age = 10): HNStory => ({
    id,
    title: id,
    url: `https://example.org/${id}`,
    discuss: `https://news.ycombinator.com/item?id=${id}`,
    domain: 'example.org',
    t: NOW - age * HOUR,
    points: 10,
    comments: 2,
    topics: [topic],
    vel,
    age,
    pred24: 20,
    measured: true,
  });
  const data = (...s: HNStory[]): HNData => new Map(s.map(x => [x.id, x]));
  it('ranks by engagement per hour, three stories per topic at most for the whole channel', () => {
    const [a, b] = [byName('Gaza war').key, byName('NATO').key];
    const d = data(story('a1', a, 9), story('a2', a, 8), story('a3', a, 7), story('a4', a, 6), story('b1', b, 1));
    const rows = hn().view(ctx(world), d, NOW).rows;
    expect(rows.map(r => r.id)).toEqual(['a1', 'a2', 'a3', 'b1']);
    expect(hn().view(ctx([byName('Gaza war')], 'topic'), d, NOW).rows).toHaveLength(4);
  });
  it('flags a young story in the top fifth as breaking out', () => {
    const a = byName('Gaza war').key;
    const d = data(story('hot', a, 50, 2), story('s1', a, 5), story('s2', a, 4), story('s3', a, 3), story('s4', a, 2));
    const rows = hn().view(ctx([byName('Gaza war')], 'topic'), d, NOW).rows;
    expect(JSON.stringify(rows[0].meta)).toContain('BREAKING OUT');
    expect(rows.slice(1).some(r => JSON.stringify(r.meta).includes('BREAKING OUT'))).toBe(false);
    expect(rows[0].side).toMatchObject({ big: '50', unit: '/h' });
  });
  it('leaves out stories about topics not in scope', () => {
    const d = data(story('x', 'elsewhere::topic', 9));
    expect(hn().view(ctx(world), d, NOW).rows).toEqual([]);
  });
});

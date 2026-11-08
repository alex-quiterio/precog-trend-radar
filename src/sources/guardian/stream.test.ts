// The Guardian stream: today's cached articles naming each topic, fetching a topic not read yet.
import { beforeEach, describe, expect, it } from 'vitest';
import { memoryBackend, useBackend } from '@core/storage';
import { fakeFetch } from '@sources/fake-fetch';
import { streamById, type StreamContext } from '@sources/streams';
import { createAppStore } from '@/state';
import type { Entry } from '@/types';
import { setGuardianKey } from './index';
import type { NewsMatch } from './stream';
import './stream';

const NOW = Date.now();
const signal = new AbortController().signal;
let world: Entry[] = [];
beforeEach(() => {
  useBackend(memoryBackend());
  const app = createAppStore();
  app.loadLenses();
  world = app.entriesOf(app.lensById('world'));
});
const ctx = (entries: Entry[], guardian = true): StreamContext => ({
  entries,
  scopeKeys: new Set(entries.map(E => E.key)),
  scope: 'lens',
  now: NOW,
  keys: { guardian },
});
const byName = (name: string) => world.find(E => E.name === name)!;
const news = () => streamById('news')!;
const article = (id: string, h: number) => ({
  id,
  type: 'article',
  sectionName: 'World news',
  webPublicationDate: new Date(NOW - h * 3600e3).toISOString(),
  webTitle: `Story ${id}`,
  webUrl: `https://www.theguardian.com/${id}`,
});
const net = fakeFetch(url => ({
  response: {
    pages: 1,
    results: url.searchParams.get('q') === 'NATO' ? [article('shared', 1), article('nato', 3)] : [article('shared', 1)],
  },
}));

describe('the Guardian stream', () => {
  it('shows its tab only once a key is set', () => {
    expect(news().available!(ctx(world, false))).toBe(false);
    expect(news().available!(ctx(world, true))).toBe(true);
  });
  it('asks for a key before loading', async () => {
    await expect(news().load(ctx(world), signal, () => {})).rejects.toThrow(/add a Guardian API key/);
  });
  it('lists each topic’s articles, merging one that names two topics, and reads each topic once a day', async () => {
    setGuardianKey('test-key');
    const two = [byName('NATO'), byName('Inflation')];
    const data = (await news().load(ctx(two), signal, () => {})) as Map<string, NewsMatch>;
    expect(net.urls).toHaveLength(2);
    expect(data.get('shared')!.topics).toEqual(two.map(E => E.key));
    await news().load(ctx(two), signal, () => {});
    expect(net.urls).toHaveLength(2);
  });
  it('puts articles naming more topics first, then the newest', async () => {
    setGuardianKey('test-key');
    const two = [byName('NATO'), byName('Inflation')];
    const data = await news().load(ctx(two), signal, () => {});
    const rows = news().view(ctx(two), data, NOW).rows;
    expect(rows.map(r => r.id)).toEqual(['shared', 'nato']);
    expect(rows[0].side).toMatchObject({ big: '2', unit: 'topics' });
    expect(rows[1].side).toMatchObject({ big: '1', unit: 'topic' });
    expect(rows[0].meta).toContainEqual({ text: 'The Guardian', cls: 'site' });
  });
});

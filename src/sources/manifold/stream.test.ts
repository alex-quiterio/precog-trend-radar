// The Forecasts stream: open Manifold markets whose question names a topic, busiest first.
import { beforeEach, describe, expect, it } from 'vitest';
import { memoryBackend, useBackend } from '@core/storage';
import { fakeFetch } from '@sources/fake-fetch';
import { streamById, type StreamContext } from '@sources/streams';
import { createAppStore } from '@/state';
import type { Entry } from '@/types';
import type { ForecastMatch } from './stream';
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
const ctx = (entries: Entry[]): StreamContext => ({
  entries,
  scopeKeys: new Set(entries.map(E => E.key)),
  scope: 'lens',
  now: NOW,
  keys: { guardian: false },
});
const byName = (name: string) => world.find(E => E.name === name)!;
const forecasts = () => streamById('forecasts')!;
const market = (id: string, question: string, vol: number, prob = 0.4, bettors = 50) => ({
  id,
  question,
  url: `https://manifold.markets/x/${id}`,
  probability: prob,
  uniqueBettorCount: bettors,
  volume24Hours: vol,
  closeTime: NOW + 365 * 86400e3,
});
fakeFetch(url =>
  url.searchParams.get('term') === 'NATO'
    ? [
        market('a', 'Will NATO add a member by 2028?', 10, 0.25),
        market('b', 'Will Natalie win?', 99),
        market('c', 'NATO summit held in 2027?', 300),
      ]
    : [],
);

describe('the Forecasts stream', () => {
  it('keeps only markets whose question names the topic as a whole word', async () => {
    const data = (await forecasts().load(ctx([byName('NATO')]), signal, () => {})) as Map<string, ForecastMatch>;
    expect([...data.values()].map(f => f.question).sort()).toEqual([
      'NATO summit held in 2027?',
      'Will NATO add a member by 2028?',
    ]);
  });
  it('lists the most traded first, with the crowd’s probability', async () => {
    const data = await forecasts().load(ctx([byName('NATO')]), signal, () => {});
    const rows = forecasts().view(ctx([byName('NATO')]), data, NOW).rows;
    expect(rows.map(r => r.id)).toEqual(['mf:c', 'mf:a']);
    expect(rows[1]).toMatchObject({ side: { big: '25%', unit: 'yes' }, bar: 25 });
    expect(rows[1].meta[0]).toMatch(/50 forecasters$/);
  });
});

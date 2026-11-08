// The Reading stream keeps rows for Campfire Stories' films, however many dated posts outrank them.
import { describe, expect, it } from 'vitest';
import { streamById, type StreamContext } from '@sources/streams';
import { CAMPFIRE } from './index';
import { libraryItems } from './parse';
import type { ReadingMatch } from './stream';
import './stream';

const NOW = Date.parse('2026-11-08T12:00:00Z');
const DAY = 86400e3;
const ctx = (now = NOW): StreamContext => ({
  entries: [],
  scopeKeys: new Set(['climate']),
  scope: 'lens',
  sites: ['https://www.thegreatsimplification.com', CAMPFIRE.url],
  now,
  keys: { guardian: false },
});
// 300 weekly episodes, each naming a topic in its title: every one outranks an unmatched film.
const episodes: ReadingMatch[] = Array.from({ length: 300 }, (_, i) => ({
  id: `ep${i}`,
  origin: 'https://www.thegreatsimplification.com',
  site: 'The Great Simplification',
  kind: 'Episode',
  num: i,
  title: `Episode ${i}`,
  url: `https://www.thegreatsimplification.com/episode/${i}`,
  t: NOW - i * 7 * DAY,
  text: '',
  topics: ['climate'],
  score: 3,
}));
const films: ReadingMatch[] = libraryItems(CAMPFIRE).map(f => ({ ...f, topics: [], score: 0 }));
const data = { found: new Map([...episodes, ...films].map(r => [r.id, r])), seen: 329, failed: null };
const reading = streamById('reading')!;

describe('Reading stream with a kept library', () => {
  it('keeps the last three rows for films, below the episodes', () => {
    const rows = reading.view(ctx(), data, NOW).rows;
    expect(rows).toHaveLength(12);
    expect(rows.slice(0, 9).every(r => r.url.includes('thegreatsimplification'))).toBe(true);
    expect(rows.slice(9).every(r => r.url.startsWith(CAMPFIRE.url))).toBe(true);
  });
  it('shows other films on other days', () => {
    const ids = (now: number) =>
      reading
        .view(ctx(now), data, now)
        .rows.slice(9)
        .map(r => r.id);
    const days = new Set(Array.from({ length: 7 }, (_, d) => ids(NOW + d * DAY).join()));
    expect(days.size).toBeGreaterThan(1);
  });
  it('names the tab after the one site that publishes', () => {
    expect(reading.tabLabel?.(ctx())).toBe('The Great Simplification');
  });
});

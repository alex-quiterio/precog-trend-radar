// iNaturalist sightings: birds recorded around a place this week, last week, and the watched ones; kept 30 minutes.
import { describe, expect, it } from 'vitest';
import { fakeFetch } from '@sources/fake-fetch';
import { WATCHED, birdSightings, type Place } from './index';

const signal = new AbortController().signal;
const NOW = Date.UTC(2026, 10, 8, 12);
const sp = (id: number, count: number) => ({
  count,
  taxon: { id, name: `Species ${id}`, preferred_common_name: `Bird ${id}` },
});
const net = fakeFetch(url => {
  const ids = url.searchParams.get('taxon_id');
  if (ids !== '3') return { results: [sp(4733, 2)] }; // the watched birds
  return url.searchParams.get('d2') === '2026-11-08'
    ? { results: [sp(1, 9), sp(2, 3)] }
    : { results: [sp(1, 4), sp(5, 1)] };
});
const place = (name: string): Place => ({ name, lat: 38.72, lng: -9.14, radius: 40 });

describe('birdSightings', () => {
  it('asks for this week, the week before, and the watched birds, around the place', async () => {
    const s = await birdSightings(place('Lisbon'), signal, NOW);
    expect(s.week.map(b => [b.id, b.count])).toEqual([
      [1, 9],
      [2, 3],
    ]);
    expect([...s.before]).toEqual([1, 5]);
    expect(s.mine.map(b => b.common)).toEqual(['Bird 4733']);
    const q = net.urls.map(u => new URL(u).searchParams);
    expect(q.map(p => [p.get('d1'), p.get('d2')])).toEqual([
      ['2026-11-02', '2026-11-08'],
      ['2026-10-26', '2026-11-01'],
      ['2026-11-02', '2026-11-08'],
    ]);
    expect(q[2].get('taxon_id')).toBe(Object.keys(WATCHED).join(','));
    expect(q.every(p => p.get('radius') === '40' && p.get('lat') === '38.72')).toBe(true);
  });
  it('keeps a place’s answer for half an hour', async () => {
    await birdSightings(place('Porto'), signal, NOW);
    await birdSightings(place('Porto'), signal, NOW + 29 * 60e3);
    expect(net.urls).toHaveLength(3);
    await birdSightings(place('Porto'), signal, NOW + 31 * 60e3);
    expect(net.urls).toHaveLength(6);
  });
});

// The sightings streams: watched birds first, then species new this week, then the most recorded.
import { describe, expect, it } from 'vitest';
import { streamById, type StreamContext } from '@sources/streams';
import type { Sightings } from './index';
import './stream';

const NOW = Date.now();
const ctx: StreamContext = { entries: [], scopeKeys: new Set(), scope: 'lens', now: NOW, keys: { guardian: false } };
const sp = (id: number, count: number) => ({ id, name: `Species ${id}`, common: `Bird ${id}`, count });
const data: Sightings = {
  mine: [sp(4733, 2)], // white stork, watched
  week: [sp(4733, 2), sp(1, 30), sp(2, 3), sp(3, 10)],
  before: new Set([1, 3]), // 2 is new this week
};

describe('Seen near Lisbon / Amsterdam', () => {
  it('registers one stream per city', () => {
    expect(streamById('seen-lisbon')?.label).toBe('Seen near Lisbon');
    expect(streamById('seen-amsterdam')?.label).toBe('Seen near Amsterdam');
  });
  it('lists watched birds first, then new species, then the most recorded', () => {
    const { rows } = streamById('seen-lisbon')!.view(ctx, data, NOW);
    expect(rows.map(r => r.title)).toEqual(['Bird 4733', 'Bird 2', 'Bird 1', 'Bird 3']);
    expect(rows[0].meta).toContainEqual({ text: 'one of yours', cls: 'flag' });
    expect(rows[1].meta).toContainEqual({ text: 'new this week', cls: 'flag' });
    expect(rows[2].url).toBe('https://www.inaturalist.org/taxa/1');
    expect(rows[2].side).toMatchObject({ big: '30', unit: 'records' });
    expect(rows[0].side.unit).toBe('records');
  });
  it('calls nothing new when there is no week before to compare with', () => {
    const { rows } = streamById('seen-lisbon')!.view(ctx, { ...data, before: new Set() }, NOW);
    expect(rows.some(r => r.meta.some(m => typeof m === 'object' && m.text === 'new this week'))).toBe(false);
  });
  it('says how many species and how many of yours, once loaded', () => {
    const at = NOW - 60e3;
    expect(streamById('seen-amsterdam')!.view(ctx, data, at).meta).toMatch(
      /4 species recorded within 40 km of Amsterdam this week · 1 of yours$/,
    );
    expect(streamById('seen-amsterdam')!.view(ctx, undefined, 0).empty).toBe(
      'No birds recorded near Amsterdam this week yet.',
    );
  });
});

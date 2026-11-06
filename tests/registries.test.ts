// Streams and open-data cards plug in through registries: these check the contracts the panels rely on.
import { describe, expect, it } from 'vitest';
import { loadCards, registerCards, type DatapointRow } from '@sources/cards';
import { registerStream, streamById, streamsFor } from '@sources/streams';

const card = (id: string, o: number): DatapointRow => ({ id, group: 'ea', k: id, v: '1', src: 's', href: '#', o });

describe('card loaders', () => {
  it('runs every loader, sorts the cards, merges facts, and isolates a failure', async () => {
    const { rows, facts, failed } = await loadCards([
      { id: 'b', load: async () => [card('second', 2)] },
      { id: 'broken', load: async () => Promise.reject(new Error('HTTP 503')) },
      { id: 'a', load: async () => ({ rows: [card('first', 1)], facts: { fire: { hi: 1, max: 0, n: 3 } } }) },
    ]);
    expect(rows.map(r => r.id)).toEqual(['first', 'second']);
    expect(facts.fire).toEqual({ hi: 1, max: 0, n: 3 });
    expect(failed).toEqual([{ id: 'broken', error: 'HTTP 503' }]);
  });
  it('refuses a loader registered twice', () => {
    registerCards({ id: 'test-twice', load: async () => [] });
    expect(() => registerCards({ id: 'test-twice', load: async () => [] })).toThrow(/twice/);
  });
});

describe('streams', () => {
  const base = { load: async () => {}, view: () => ({ rows: [], meta: '', empty: '' }) };
  it('lists a channel’s streams in its order, skipping unknown and unavailable ones', () => {
    registerStream({ id: 'test-a', label: 'A', ...base });
    registerStream({ id: 'test-b', label: 'B', ...base });
    registerStream({ id: 'test-off', label: 'Off', available: () => false, ...base });
    expect(
      streamsFor(['test-b', 'nope', 'test-off', 'test-a'], {
        entries: [],
        scopeKeys: new Set(),
        scope: 'lens',
        now: 0,
        keys: { guardian: false },
      }).map(s => s.id),
    ).toEqual(['test-b', 'test-a']);
    expect(streamById('test-a')?.label).toBe('A');
  });
  it('refuses a stream registered twice', () => {
    expect(() => registerStream({ id: 'test-a', label: 'A again', ...base })).toThrow(/twice/);
  });
});

describe('open-data stores', () => {
  it('are per app: each runs its own loaders and keeps its own cards', async () => {
    const { createDatapoints } = await import('@features/datapoints');
    const a = createDatapoints([{ id: 'x', load: async () => [card('only-a', 1)] }]),
      b = createDatapoints([]);
    await Promise.all([a.load(), b.load()]);
    expect(a.state.rows.map(r => r.id)).toEqual(['only-a']);
    expect(b.state.rows).toEqual([]);
    expect(a.state.at).toBeGreaterThan(0);
  });
});

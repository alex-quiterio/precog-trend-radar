// The open-data card registry: the contract the Open data panel relies on.
import { describe, expect, it } from 'vitest';
import { loadCards, registerCards, type DatapointRow } from '@sources/cards';

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

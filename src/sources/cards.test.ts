// The open-data card registry: the contract the Open data panel relies on.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryBackend, useBackend } from '@core/storage';
import { keptForADay, loadCards, registerCards, type DatapointRow } from '@sources/cards';

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

describe('numbers kept for a day', () => {
  beforeEach(() => {
    useBackend(memoryBackend());
    vi.useRealTimers();
  });
  it('fetches once, then answers from storage for 24 hours', async () => {
    const fetchIt = vi.fn(async () => ({ n: 1 }));
    expect(await keptForADay('test.kept', fetchIt)).toEqual({ n: 1 });
    expect(await keptForADay('test.kept', fetchIt)).toEqual({ n: 1 });
    expect(fetchIt).toHaveBeenCalledTimes(1);
  });
  it('fetches again the next day, and keeps the old copy when that fails', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse('2026-11-11T08:00:00Z'));
    await keptForADay('test.kept', async () => 'monday');
    vi.setSystemTime(Date.parse('2026-11-12T09:00:00Z'));
    expect(await keptForADay('test.kept', async () => Promise.reject(new Error('down')))).toBe('monday');
    expect(await keptForADay('test.kept', async () => 'tuesday')).toBe('tuesday');
    vi.useRealTimers();
  });
  it('fails when the fetch fails and nothing was kept', async () => {
    await expect(keptForADay('test.kept', async () => Promise.reject(new Error('down')))).rejects.toThrow('down');
  });
});

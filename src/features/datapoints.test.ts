// The open-data store: one per app.
import { describe, expect, it, vi } from 'vitest';
import type { DatapointRow } from '@sources/cards';
import { createDatapoints } from '@features/datapoints';

const card = (id: string, o: number): DatapointRow => ({
  id,
  group: 'ea',
  k: id,
  v: '1',
  src: 's',
  href: '#',
  o,
});

describe('open-data stores', () => {
  it('are per app: each runs its own loaders and keeps its own cards', async () => {
    const a = createDatapoints([
        {
          id: 'x',
          cards: ['only-a'],
          load: async () => [card('only-a', 1)],
        },
      ]),
      b = createDatapoints([]);
    await Promise.all([a.load(), b.load()]);
    expect(a.state.rows.map(r => r.id)).toEqual(['only-a']);
    expect(b.state.rows).toEqual([]);
    expect(a.state.at).toBeGreaterThan(0);
  });
});

describe('loading by channel', () => {
  const loaders = () => ({
    fire: vi.fn(async () => [card('fire', 1)]),
    rate: vi.fn(async () => [card('ecb', 2)]),
    hpi: vi.fn(async () => [
      card('hpi-pt', 3),
      card('hpi-nl', 4),
    ]),
  });
  const store = (l: ReturnType<typeof loaders>) =>
    createDatapoints([
      { id: 'ipma', cards: ['fire'], load: l.fire },
      { id: 'ecb', cards: ['ecb'], load: l.rate },
      {
        id: 'hpi',
        cards: ['hpi-pt', 'hpi-nl'],
        load: l.hpi,
      },
    ]);
  it('runs only the loaders the channel on screen needs, and the rest when a channel needing them opens', async () => {
    const l = loaders(),
      dp = store(l);
    await dp.load(['fire', 'ecb']); // Portugal-ish
    expect(l.fire).toHaveBeenCalledOnce();
    expect(l.rate).toHaveBeenCalledOnce();
    expect(l.hpi).not.toHaveBeenCalled();
    await dp.load(['hpi-pt', 'ecb']); // Housing: the rate is fresh, so only house prices are fetched
    expect(l.rate).toHaveBeenCalledOnce();
    expect(l.hpi).toHaveBeenCalledOnce();
    expect(dp.state.rows.map(r => r.id)).toEqual([
      'fire',
      'ecb',
      'hpi-pt',
      'hpi-nl',
    ]); // kept for every channel
  });
  it('fetches the same cards again only after an hour, and a failed loader on the next try', async () => {
    vi.useFakeTimers();
    try {
      const l = loaders();
      l.fire.mockRejectedValueOnce(new Error('HTTP 503'));
      const dp = store(l);
      await dp.load(['fire', 'ecb']);
      expect(dp.state.failed).toEqual([
        { id: 'ipma', error: 'HTTP 503' },
      ]);
      await dp.load(['fire', 'ecb']); // the failure is retried; the rate isn't fetched again
      expect(l.fire).toHaveBeenCalledTimes(2);
      expect(l.rate).toHaveBeenCalledOnce();
      expect(dp.state.failed).toEqual([]);
      vi.advanceTimersByTime(61 * 60e3);
      await dp.load(['ecb']);
      expect(l.rate).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
  it('counts as loading while a load runs, so the panel never says none could be loaded meanwhile', async () => {
    let release: () => void = () => {};
    const dp = createDatapoints([
      {
        id: 'slow',
        cards: ['x'],
        load: () =>
          new Promise(
            r => (release = () => r([card('x', 1)])),
          ),
      },
    ]);
    const running = dp.load(['x']);
    expect(dp.state.loading).toBe(1);
    release();
    await running;
    expect(dp.state.loading).toBe(0);
  });
});

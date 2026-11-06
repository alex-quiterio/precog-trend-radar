// The data loop with fake trend sources: loading, partial and total failure, cancellation, refresh.
import { reactive } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { createLiveLoop, type LoopUi } from '@/live';
import type { Adapter, AdapterResult, Alert, Entry, Source } from '@/types';

const DAY = 86400e3;
const today = Math.floor(Date.now() / DAY) * DAY;
/** 40 days of a steady count, ending yesterday. */
const days = (value: number) => Array.from({ length: 40 }, (_, i) => ({ t: today - (40 - i) * DAY, value }));

function entry(name: string): Entry {
  return reactive({
    key: `test::${name.toLowerCase()}`,
    lensId: 'test',
    def: { name, slot: 0 },
    name,
    slot: 0,
    color: '#000',
    angle: 0,
    parts: {},
    partErr: {},
    meta: {},
    liveSeries: [],
    liveError: null,
    stats: null,
    lastAlert: null,
  }) as Entry;
}
const adapter = (id: string, fetch: (topic: string, signal: AbortSignal) => Promise<AdapterResult>): Adapter => ({
  id,
  label: `${id} stories / day`,
  fetch: (topic, ctx) => fetch(topic, ctx.signal),
});
function setup(adapters: Adapter[], names = ['Rust', 'Solar']) {
  const ui = reactive<LoopUi>({
    status: '',
    pulse: '',
    beat: 0,
    loading: false,
    offline: false,
    guardian: false,
    guardianState: 'off',
    guardianNote: '',
  });
  const state = reactive({ source: 'blend', liveLoaded: false, alerts: [] as Alert[] });
  const entries = names.map(entry);
  const sources: Record<string, Source> = { blend: { label: 'index', parts: adapters.map(a => a.id), blend: true } };
  const onLoaded = vi.fn();
  const loop = createLiveLoop({
    adapters: Object.fromEntries(adapters.map(a => [a.id, a])),
    sources,
    state,
    ui,
    entries: () => entries,
    onLoaded,
  });
  return { loop, ui, state, entries, onLoaded };
}

describe('the data loop', () => {
  it('loads every topic from every source, blends them and reports success', async () => {
    const { loop, ui, state, entries, onLoaded } = setup([
      adapter('a', async () => ({ topic: '', points: days(100) })),
      adapter('b', async () => ({ topic: '', points: days(10) })),
    ]);
    await loop.load();
    expect(state.liveLoaded).toBe(true);
    expect(ui.loading).toBe(false);
    expect(ui.status).toMatch(/^Live · updated .* refreshes every 30 min\.$/);
    expect(onLoaded).toHaveBeenCalledOnce();
    for (const E of entries) {
      expect(E.liveSeries.length).toBeGreaterThan(20);
      expect(E.stats?.latest).toBeCloseTo(100); // both sources at their own norm: index 100
    }
  });

  it('keeps a topic going when one source fails for it, and says what is missing', async () => {
    const { loop, ui, entries } = setup([
      adapter('a', async () => ({ topic: '', points: days(100) })),
      adapter('b', async topic => {
        if (topic === 'Solar') throw new Error('HTTP 503');
        return { topic, points: days(10) };
      }),
    ]);
    await loop.load();
    const solar = entries[1];
    expect(solar.partErr.b).toBe('HTTP 503');
    expect(solar.liveError).toBeNull(); // still charted, from source a
    expect(solar.liveSeries.length).toBeGreaterThan(0);
    expect(ui.status).toContain('Missing: b for 1 topic.');
    expect(ui.offline).toBe(false);
  });

  it('says so when no source can be reached at all', async () => {
    const { loop, ui, entries } = setup([adapter('a', async () => Promise.reject(new TypeError('Failed to fetch')))]);
    await loop.load();
    expect(entries.every(E => E.liveError === 'Failed to fetch')).toBe(true);
    expect(ui.offline).toBe(true);
    expect(ui.status).toMatch(/^Couldn't reach any source \(Failed to fetch\)/);
  });

  it('shows a skip as a reason, not an error', async () => {
    const { loop, entries } = setup([
      adapter('a', async () => ({ topic: '', points: days(100) })),
      adapter('b', async topic => ({ topic, points: [], skip: 'English-only' })),
    ]);
    await loop.load();
    expect(entries[0].skipped).toEqual({ b: 'English-only' });
    expect(entries[0].partErr.b).toBeNull();
    expect(entries[0].liveError).toBeNull();
  });

  it('lets a newer load cancel an older one, so stale results never land', async () => {
    let round = 0;
    const { loop, ui, entries, onLoaded } = setup(
      [
        adapter('a', (topic, signal) => {
          const mine = ++round;
          return new Promise((resolve, reject) => {
            const value = mine === 1 ? 999 : 100;
            const t = setTimeout(() => resolve({ topic, points: days(value) }), mine === 1 ? 50 : 5);
            signal.addEventListener('abort', () => {
              clearTimeout(t);
              reject(new DOMException('aborted', 'AbortError'));
            });
          });
        }),
      ],
      ['Rust'],
    );
    const first = loop.load();
    expect(ui.loading).toBe(true);
    expect(loop.signal()).toBeDefined();
    const second = loop.load(); // cancels the first
    await Promise.all([first, second]);
    expect(entries[0].stats?.latest).toBe(100); // the first load's 999 never landed
    expect(entries[0].partErr.a).toBeNull(); // the cancellation isn't an error
    expect(onLoaded).toHaveBeenCalledOnce();
    expect(ui.loading).toBe(false);
    expect(loop.signal()).toBeUndefined();
  });

  it('ignores refresh while a load is running', async () => {
    const fetch = vi.fn(async (topic: string) => ({ topic, points: days(5) }));
    const { loop } = setup([adapter('a', fetch)], ['Rust']);
    const running = loop.load();
    loop.refresh();
    await running;
    expect(fetch).toHaveBeenCalledOnce();
    expect(loop.updated()).toBeGreaterThan(0);
  });

  it('start clears what was there and stop cancels the timer', async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn(async (topic: string) => ({ topic, points: days(5) }));
      const { loop, entries, state } = setup([adapter('a', fetch)], ['Rust']);
      entries[0].liveError = 'old';
      loop.start();
      expect(entries[0].liveError).toBeNull();
      expect(state.liveLoaded).toBe(false);
      await vi.advanceTimersByTimeAsync(30 * 60e3); // one refresh
      expect(fetch).toHaveBeenCalledTimes(2);
      loop.stop();
      await vi.advanceTimersByTimeAsync(60 * 60e3);
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

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
    lang: 'en',
    country: null,
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

  it('stop ends a load in flight, so the page stops showing it as loading and refresh works again', async () => {
    let release = () => {};
    const fetch = vi.fn(
      (topic: string) =>
        new Promise<{ topic: string; points: ReturnType<typeof days> }>(
          r => (release = () => r({ topic, points: days(5) })),
        ),
    );
    const { loop, ui } = setup([adapter('a', fetch)], ['Rust']);
    const running = loop.load();
    expect(ui.loading).toBe(true);
    loop.stop();
    expect(ui.loading).toBe(false);
    release();
    await running;
    expect(loop.updated()).toBe(0); // the cancelled load never landed
    loop.refresh();
    expect(fetch).toHaveBeenCalledTimes(2);
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

describe('the channel on screen first', () => {
  /** Topics in three channels, and a loop that treats channel `screen.lens` as the one on screen. */
  function channels(fetch: (topic: string) => Promise<AdapterResult>) {
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
    const entries = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'c3'].map(n => {
      const E = entry(n);
      E.lensId = n[0];
      return E;
    });
    const screen = { lens: 'a' };
    const ready = vi.fn(() => ({ liveLoaded: state.liveLoaded, loading: ui.loading, status: ui.status }));
    const onLoaded = vi.fn();
    const loop = createLiveLoop({
      adapters: { a: { ...adapter('a', fetch), concurrency: 4 } },
      sources: { blend: { label: 'index', parts: ['a'], blend: true } },
      state,
      ui,
      entries: () => entries,
      onScreen: E => E.lensId === screen.lens,
      onScreenReady: ready,
      onLoaded,
      backgroundGapMs: 1,
    });
    return { loop, ui, state, entries, screen, ready, onLoaded };
  }

  it('loads the channel on screen first, and counts the screen as loaded before the rest are in', async () => {
    const order: string[] = [];
    const { loop, ready, onLoaded, ui } = channels(async topic => {
      order.push(topic);
      await new Promise(r => setTimeout(r, 2));
      return { topic, points: days(100) };
    });
    await loop.load();
    expect(order.slice(0, 2).sort()).toEqual(['a1', 'a2']);
    expect(ready).toHaveBeenCalledOnce();
    expect(ready.mock.results[0].value).toMatchObject({ liveLoaded: true, loading: false });
    expect(ready.mock.results[0].value.status).toMatch(/Other channels are catching up\.$/);
    expect(onLoaded).toHaveBeenCalledOnce(); // once everything is in
    expect(ui.status).not.toContain('catching up');
  });

  it('fetches the other channels one at a time per source, so a cold start never floods it', async () => {
    let background = 0,
      most = 0;
    const { loop } = channels(async topic => {
      const bg = !topic.startsWith('a');
      if (bg) most = Math.max(most, ++background);
      await new Promise(r => setTimeout(r, 2));
      if (bg) background--;
      return { topic, points: days(100) };
    });
    await loop.load();
    expect(most).toBe(1);
  });

  it('moves a channel you switch to mid-load to the front, and shows it loading until it is in', async () => {
    const order: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>(r => (release = r));
    const { loop, ui, state, screen } = channels(async topic => {
      order.push(topic);
      if (!topic.startsWith('a')) await gate; // the background waits until we've switched
      return { topic, points: days(100) };
    });
    const running = loop.load();
    await vi.waitFor(() => expect(state.liveLoaded).toBe(true)); // channel a is in
    screen.lens = 'c';
    loop.focus();
    expect(state.liveLoaded).toBe(false);
    expect(ui.loading).toBe(true);
    release();
    await running;
    // After the one background request already in flight (b1), channel c comes before the rest of b.
    expect(order.slice(3, 6).sort()).toEqual(['c1', 'c2', 'c3']);
    expect(state.liveLoaded).toBe(true);
    expect(ui.loading).toBe(false);
  });
});

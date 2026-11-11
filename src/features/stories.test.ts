// The stream loader with fake streams: which stream loads, errors, and a newer load cancelling an older one.
import { describe, expect, it } from 'vitest';
import { createStoryLoader } from '@features/stories';
import type { Stream, StreamContext } from '@sources/streams';

const ctx: StreamContext = { entries: [], scopeKeys: new Set(), scope: 'lens', now: 0, keys: { guardian: false } };
const stream = (id: string, load: Stream['load']): Stream => ({
  id,
  label: id,
  load,
  view: () => ({ rows: [], meta: '', empty: '' }),
});
function setup(streams: Stream[], current = 'b') {
  const now = { current };
  const loader = createStoryLoader({
    shown: () => streams,
    current: () => now.current,
    select: id => void (now.current = id),
    context: () => ctx,
  });
  return { loader, now };
}

describe('the stream loader', () => {
  it('switches to the channel’s first stream when the current one isn’t shown', async () => {
    const { loader, now } = setup([stream('a', async () => {})], 'gone');
    await loader.load();
    expect(now.current).toBe('a');
    expect(loader.status.at.a).toBeGreaterThan(0);
    expect(loader.status.loading.a).toBe(false);
  });
  it('records an error for the stream that failed, and clears it on the next success', async () => {
    let fail = true;
    const { loader } = setup([
      stream('b', async () => {
        if (fail) throw new Error('HTTP 429');
      }),
    ]);
    await loader.load();
    expect(loader.status.errors.b).toBe('HTTP 429');
    fail = false;
    await loader.load();
    expect(loader.status.errors.b).toBeNull();
  });
  it('lets a newer load cancel an older one without recording the cancellation', async () => {
    let calls = 0;
    const { loader } = setup([
      stream(
        'b',
        (_ctx, signal) =>
          new Promise<void>((resolve, reject) => {
            calls++;
            const t = setTimeout(resolve, calls === 1 ? 50 : 5);
            signal.addEventListener('abort', () => {
              clearTimeout(t);
              reject(new DOMException('aborted', 'AbortError'));
            });
          }),
      ),
    ]);
    const first = loader.load();
    expect(loader.status.loading.b).toBe(true);
    const second = loader.load();
    await Promise.all([first, second]);
    expect(loader.status.errors.b).toBeNull();
    expect(loader.status.loading.b).toBe(false);
  });
  it('stops showing a cancelled stream as loading when you come back to it before it has let go', async () => {
    // Stream b notices the cancellation late (it is waiting its turn in a rate-limit queue).
    let release = () => {};
    const slow = stream(
      'b',
      (_ctx, signal) =>
        new Promise<void>((resolve, reject) => {
          release = () => (signal.aborted ? reject(new DOMException('aborted', 'AbortError')) : resolve());
        }),
    );
    const { loader, now } = setup([slow, stream('a', async () => {})]);
    const first = loader.load();
    expect(loader.status.loading.b).toBe(true);
    now.current = 'a'; // to another tab: its load cancels b's…
    await loader.load();
    now.current = 'b'; // …and straight back, which loads nothing
    release();
    await first;
    expect(loader.status.loading.b).toBe(false);
  });
  it('leaves the flag to the newer load when the same stream is loaded again', async () => {
    const releases: (() => void)[] = [];
    const { loader } = setup([
      stream(
        'b',
        (_ctx, signal) =>
          new Promise<void>((resolve, reject) => {
            releases.push(() => (signal.aborted ? reject(new DOMException('aborted', 'AbortError')) : resolve()));
          }),
      ),
    ]);
    const first = loader.load(),
      second = loader.load();
    releases[0]();
    await first;
    expect(loader.status.loading.b).toBe(true); // the second load is still running
    releases[1]();
    await second;
    expect(loader.status.loading.b).toBe(false);
  });
  it('keeps each stream’s data per loader, showing partial results while loading', async () => {
    const seen: unknown[] = [];
    const s = stream('b', async (_ctx, _signal, show) => {
      show(['first']);
      seen.push(a.loader.status.data.b);
      return ['first', 'second'];
    });
    const a = setup([s]),
      b = setup([s]);
    await a.loader.load();
    expect(seen).toEqual([['first']]); // the partial result, shown before the load finished
    expect(a.loader.status.data.b).toEqual(['first', 'second']);
    expect(b.loader.status.data.b).toBeUndefined(); // another app's loader has its own data
  });
});

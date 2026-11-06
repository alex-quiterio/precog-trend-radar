// The stream loader with fake streams: which stream loads, errors, and a newer load cancelling an older one.
import { describe, expect, it } from 'vitest';
import { createStoryLoader } from '@features/stories';
import type { Stream, StreamContext } from '@sources/streams';

const ctx: StreamContext = { entries: [], scopeKeys: new Set(), scope: 'lens' };
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
});

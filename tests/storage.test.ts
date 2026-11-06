// The store: JSON values that never throw, over a swappable backend.
import { afterEach, describe, expect, it } from 'vitest';
import { browserBackend, dropKeys, memoryBackend, store, useBackend } from '@core/storage';

afterEach(() => void useBackend(memoryBackend()));

describe('store', () => {
  it('reads back what it wrote, and the default for anything missing or unreadable', () => {
    const mem = useBackend(memoryBackend({ broken: '{not json' }));
    store.set('a', { n: 1 });
    expect(store.get('a', null)).toEqual({ n: 1 });
    expect(store.get('missing', 'dflt')).toBe('dflt');
    expect(store.get('broken', 'dflt')).toBe('dflt');
    store.remove('a');
    expect(mem.data.has('a')).toBe(false);
  });
  it('drops stale caches and retries when storage is full', () => {
    const mem = memoryBackend({ 'precog.guardian.v1.x': 'old', 'precog.prefs.v2': '{}' });
    let full = true;
    useBackend({
      ...mem,
      setItem: (k, v) => {
        if (full && mem.data.has('precog.guardian.v1.x')) throw new DOMException('full', 'QuotaExceededError');
        full = false;
        mem.setItem(k, v);
      },
    });
    store.set('precog.new', 1);
    expect(mem.data.has('precog.guardian.v1.x')).toBe(false); // dropped
    expect(mem.data.get('precog.new')).toBe('1');
    expect(mem.data.has('precog.prefs.v2')).toBe(true); // kept
  });
  it('never throws when storage is unavailable', () => {
    const boom = () => {
      throw new Error('denied');
    };
    useBackend({ getItem: boom, setItem: boom, removeItem: boom, keys: boom });
    expect(store.get('a', 1)).toBe(1);
    expect(() => store.set('a', 2)).not.toThrow();
    expect(() => dropKeys(/./)).not.toThrow();
  });
  it('falls back to memory where there is no localStorage (as here, in Node)', () => {
    const b = browserBackend();
    b.setItem('k', 'v');
    expect(b.getItem('k')).toBe('v');
  });
});

// The stream registry: the contract the streams panel relies on.
import { describe, expect, it } from 'vitest';
import { registerStream, streamById, streamsFor } from '@sources/streams';

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

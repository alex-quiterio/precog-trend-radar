// The open-data store: one per app.
import { describe, expect, it } from 'vitest';
import type { DatapointRow } from '@sources/cards';
import { createDatapoints } from '@features/datapoints';

const card = (id: string, o: number): DatapointRow => ({ id, group: 'ea', k: id, v: '1', src: 's', href: '#', o });

describe('open-data stores', () => {
  it('are per app: each runs its own loaders and keeps its own cards', async () => {
    const a = createDatapoints([{ id: 'x', load: async () => [card('only-a', 1)] }]),
      b = createDatapoints([]);
    await Promise.all([a.load(), b.load()]);
    expect(a.state.rows.map(r => r.id)).toEqual(['only-a']);
    expect(b.state.rows).toEqual([]);
    expect(a.state.at).toBeGreaterThan(0);
  });
});

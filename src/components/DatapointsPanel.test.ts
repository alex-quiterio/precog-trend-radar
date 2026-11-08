// @vitest-environment happy-dom
// The open-data panel rendered with fake cards: channels pick their cards, under place headings.
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import DatapointsPanel from '@components/DatapointsPanel.vue';
import { memoryBackend, useBackend } from '@core/storage';
import type { DatapointRow } from '@features/datapoints';
import { contextPlugin, createContext } from '@/context';

const ctx = createContext();
const { state } = ctx.app;
const dp = ctx.datapoints.state;
/** Mounts a panel with this test's own app context. */
const mountPanel = (c: Parameters<typeof mount>[0]) => mount(c, { global: { plugins: [contextPlugin(ctx)] } });

beforeAll(() => {
  vi.stubGlobal('fetch', () => new Promise(() => {})); // no network in tests
  useBackend(memoryBackend());
  ctx.app.loadLenses();
});

describe('the open-data panel', () => {
  const card = (id: string, group: DatapointRow['group'], o: number): DatapointRow => ({
    id,
    group,
    k: `Card ${id}`,
    v: '1%',
    src: 'test',
    href: '#',
    o,
  });
  it('shows only the cards the channel lists, under their place headings', async () => {
    state.activeLens = 'world'; // lists inflation-ea, ecb, unemployment-ea, co2
    Object.assign(dp, {
      rows: [card('ecb', 'ea', 1), card('co2', 'planet', 20), card('fire', 'pt', 3)],
      at: Date.now(),
    });
    const w = mountPanel(DatapointsPanel);
    await nextTick();
    const text = w.text();
    expect(text).toContain('Card ecb');
    expect(text).toContain('Card co2');
    expect(text).not.toContain('Card fire'); // a Portugal card, not on the World channel
    expect(w.findAll('.dp-group h4').map(h => h.text())).toEqual(['Euro area', 'Planet']);
    w.unmount();
  });
});

// @vitest-environment happy-dom
// The streams panel rendered with fake data: every stream's rows draw alike.
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import StoriesPanel from '@components/StoriesPanel.vue';
import { memoryBackend, useBackend } from '@core/storage';
import { registerStream, type StreamRow } from '@sources/streams';
import { contextPlugin, createContext } from '@/context';

const ctx = createContext();
const { app } = ctx;
const { state } = app;
const stories = ctx.stories.status;
/** Mounts a panel with this test's own app context. */
const mountPanel = (c: Parameters<typeof mount>[0]) => mount(c, { global: { plugins: [contextPlugin(ctx)] } });

let topicKey = '';
const rows: StreamRow[] = [];
beforeAll(() => {
  vi.stubGlobal('fetch', () => new Promise(() => {})); // no network in tests
  useBackend(memoryBackend());
  app.loadLenses();
  state.activeLens = 'world'; // shows the news, forecasts, reading and hn streams
  topicKey = app.entriesOf(app.lensById('world'))[0].key;
  // Stand-ins for two streams the World channel lists. The real ones register from sources/index.ts, which
  // these tests don't import (Hacker News is real: the gist imports it).
  registerStream({
    id: 'reading',
    label: 'Reading',
    load: async () => {},
    view: () => ({ rows, meta: 'ranked', empty: 'Nothing yet.' }),
  });
  registerStream({
    id: 'forecasts',
    label: 'Forecasts',
    load: async () => {},
    view: () => ({ rows: [], meta: '', empty: 'No forecasts.' }),
  });
});

describe('the streams panel', () => {
  it('shows one tab per stream the channel lists and that is registered', async () => {
    state.storySrc = 'reading';
    const w = mountPanel(StoriesPanel);
    expect(w.findAll('.seg button').map(b => b.text())).toEqual([
      'Forecasts',
      'Hacker News',
      'Reading',
      'This topic',
      'Whole channel',
    ]);
    w.unmount();
  });
  it('draws a stream’s rows: title, topic chips, meta labels, links, flags and the figure', async () => {
    rows.splice(0, rows.length, {
      id: 'r1',
      title: 'A story',
      url: 'https://example.org/story',
      topics: [topicKey, 'elsewhere::not-in-scope'],
      meta: [
        'example.org',
        { text: '12 pts', href: 'https://news.example/1' },
        { text: '↗ BREAKING OUT', cls: 'flag' },
      ],
      side: { big: '42', unit: '/h', note: 'measured' },
      bar: 50,
    });
    state.storySrc = 'reading';
    const w = mountPanel(StoriesPanel);
    await nextTick();
    const row = w.find('li.story');
    expect(row.find('.title a').attributes('href')).toBe('https://example.org/story');
    expect(row.findAll('.stopic')).toHaveLength(1); // only topics in scope
    expect(row.find('.smeta a').attributes('href')).toBe('https://news.example/1');
    expect(row.find('.flag').text()).toBe('↗ BREAKING OUT');
    expect(row.find('.vel b').text()).toBe('42');
    expect(row.find('.vbar i').attributes('style')).toContain('width: 50.0%');
    w.unmount();
  });
  it('says why a stream is empty: loading, an error, or nothing found', async () => {
    state.storySrc = 'forecasts';
    const w = mountPanel(StoriesPanel);
    expect(w.find('li.empty').text()).toBe('No forecasts.');
    stories.errors.forecasts = 'HTTP 429';
    await nextTick();
    expect(w.find('li.empty').text()).toBe('Could not load: HTTP 429.');
    stories.loading.forecasts = true;
    await nextTick();
    expect(w.find('li.empty').text()).toBe('Loading…');
    w.unmount();
  });
});

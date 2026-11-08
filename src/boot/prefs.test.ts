// Start-up: restoring the last visit's view, checked before use, and dropping old caches.
import { beforeEach, describe, expect, it } from 'vitest';
import { LS, store } from '@core/config';
import { memoryBackend, useBackend } from '@core/storage';
import { createContext } from '@/context';
import { OLD_CACHES, restore } from './prefs';

let mem: Map<string, string>;
beforeEach(() => {
  mem = useBackend(memoryBackend()).data;
});

describe('restore', () => {
  it('opens a first visit dark, on the first channel, reading', () => {
    const ctx = createContext();
    restore(ctx);
    const { state, ui } = ctx.app;
    expect(ui.theme).toBe('dark');
    expect(state.activeLens).toBe(state.lenses[0].id);
    expect(state).toMatchObject({ storySrc: 'reading', storyScope: 'lens', selectedByLens: {} });
  });
  it('brings back the last theme, channel, topic, stream and scope', () => {
    store.set(LS.prefs, {
      theme: 'light',
      activeLens: 'tgs',
      selectedByLens: { tgs: 'k1' },
      storySrc: 'forecasts',
      storyScope: 'topic',
    });
    const ctx = createContext();
    restore(ctx);
    expect(ctx.app.ui.theme).toBe('light');
    expect(ctx.app.state).toMatchObject({
      activeLens: 'tgs',
      selectedByLens: { tgs: 'k1' },
      storySrc: 'forecasts',
      storyScope: 'topic',
    });
  });
  it('falls back to defaults for anything unusable', () => {
    store.set(LS.prefs, { theme: 'neon', activeLens: 'gone', selectedByLens: 'x', storySrc: 3, storyScope: 'all' });
    const ctx = createContext();
    restore(ctx);
    expect(ctx.app.ui.theme).toBe('dark');
    expect(ctx.app.state).toMatchObject({
      activeLens: ctx.app.state.lenses[0].id,
      selectedByLens: {},
      storySrc: 'reading',
      storyScope: 'lens',
    });
  });
  it('notes which keys are set', () => {
    store.set('precog.guardian.key', 'test-key');
    store.set('precog.github.token', 'ghp_x');
    const ctx = createContext();
    restore(ctx);
    expect(ctx.app.ui).toMatchObject({ guardian: true, ghToken: true });
  });
  it('drops caches older versions wrote, and keeps the rest', () => {
    ['precog.gdelt.x', 'precog.reading.v1.a', 'precog.guardian.v1.b', 'precog.tgs.c', 'precog.rss.d'].forEach(k =>
      mem.set(k, '1'),
    );
    mem.set('precog.reading.v3.https://example.org', '{}');
    restore(createContext());
    expect([...mem.keys()].filter(k => OLD_CACHES.test(k))).toEqual([]);
    expect(mem.has('precog.reading.v3.https://example.org')).toBe(true);
  });
});

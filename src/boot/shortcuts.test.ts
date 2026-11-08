// @vitest-environment happy-dom
// Keyboard shortcuts: what each key does, and when keys are left alone.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { shortcut } from '@/boot/shortcuts';
import { channels } from '@/channels';
import { memoryBackend, useBackend } from '@core/storage';
import { createContext } from '@/context';

const key = (k: string, mods: Partial<KeyboardEvent> = {}) => ({
  key: k,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...mods,
});

const ctx = createContext();
const { app } = ctx;
const { state } = app;

beforeAll(() => {
  vi.stubGlobal('fetch', () => new Promise(() => {})); // switching channel starts loads; no network in tests
  useBackend(memoryBackend());
  app.loadLenses();
  state.activeLens = state.lenses[0].id;
});

describe('keyboard shortcuts', () => {
  it('jumps to a channel by its number', () => {
    shortcut(ctx, key('3'), document.body)?.();
    expect(state.activeLens).toBe(channels(app)[2].lensId);
  });
  it('steps through channels with [ and ]', () => {
    shortcut(ctx, key(']'), document.body)?.();
    expect(state.activeLens).toBe(channels(app)[3].lensId);
    shortcut(ctx, key('['), document.body)?.();
    expect(state.activeLens).toBe(channels(app)[2].lensId);
  });
  it('steps through the channel’s topics with the arrow keys', () => {
    const before = app.selectedEntry()?.name;
    shortcut(ctx, key('ArrowRight'), document.body)?.();
    expect(app.selectedEntry()?.name).not.toBe(before);
    expect(app.selectedEntry()?.lensId).toBe(app.activeLens()?.id);
  });
  it('leaves keys alone while typing, with a modifier held, and for other keys', () => {
    const input = document.createElement('input');
    document.body.append(input);
    expect(shortcut(ctx, key('3'), input)).toBeNull();
    expect(shortcut(ctx, key('3', { metaKey: true }), document.body)).toBeNull();
    expect(shortcut(ctx, key('0'), document.body)).toBeNull();
    expect(shortcut(ctx, key('x'), document.body)).toBeNull();
  });
});

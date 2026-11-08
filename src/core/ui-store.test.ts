// UI state: one per app, with a clock that ticks every minute.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUi, startClock } from './ui-store';

afterEach(() => vi.useRealTimers());

describe('UI state', () => {
  it('starts dark, idle, with no keys set', () => {
    const ui = createUi();
    expect(ui).toMatchObject({ theme: 'dark', loading: false, offline: false, guardian: false, ghToken: false });
  });
  it('is per app, never shared', () => {
    const a = createUi(),
      b = createUi();
    a.theme = 'light';
    expect(b.theme).toBe('dark');
  });
  it('ticks the clock every minute until stopped', () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 8, 12) });
    const ui = createUi();
    const stop = startClock(ui);
    vi.advanceTimersByTime(60e3);
    expect(ui.now).toBe(Date.UTC(2026, 10, 8, 12, 1));
    stop();
    vi.advanceTimersByTime(5 * 60e3);
    expect(ui.now).toBe(Date.UTC(2026, 10, 8, 12, 1));
  });
});

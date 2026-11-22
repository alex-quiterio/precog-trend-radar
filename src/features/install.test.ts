// Installing PRECOG as an app: which way this browser installs, when the notice asks, and the π-day "Not now".
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { DAY, store } from '@core/config';
import { memoryBackend, useBackend } from '@core/storage';
import {
  INSTALL_KEY,
  SNOOZE_DAYS,
  askAgainAt,
  createInstall,
  dueToAsk,
  safariWay,
} from './install';

const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  oldMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
  chrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
};

/** A window with just what the notice uses: events, a user agent, and whether it runs as an installed app. */
function fakeWindow(
  ua: string,
  opts: { standalone?: boolean; touch?: number } = {},
) {
  const target = new EventTarget();
  return Object.assign(target, {
    navigator: {
      userAgent: ua,
      maxTouchPoints: opts.touch ?? 0,
    },
    matchMedia: () => ({ matches: !!opts.standalone }),
  }) as unknown as Window;
}
/** The prompt Chrome hands over, answering with `outcome`. */
function promptEvent(outcome: 'accepted' | 'dismissed') {
  const e = new Event('beforeinstallprompt', {
    cancelable: true,
  });
  return Object.assign(e, {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome }),
  });
}

const NOW = Date.UTC(2026, 10, 22, 9);
beforeEach(() => {
  useBackend(memoryBackend());
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('installing PRECOG', () => {
  it('knows the Safari way: Home Screen on an iPhone or iPad, Add to Dock in Safari 17 or later on a Mac', () => {
    expect(safariWay(UA.iphone, 5)).toBe('ios');
    expect(safariWay(UA.mac, 5)).toBe('ios'); // an iPad says it's a Mac, but has a touch screen
    expect(safariWay(UA.mac, 0)).toBe('mac-safari');
    expect(safariWay(UA.oldMac, 0)).toBeNull();
    expect(safariWay(UA.chrome, 0)).toBeNull(); // Chrome hands over its own prompt instead
  });
  it('asks again after π days, and never once done', () => {
    expect(SNOOZE_DAYS).toBe(3.1415);
    expect(askAgainAt(NOW)).toBe(NOW + 3.1415 * DAY);
    expect(dueToAsk({}, NOW)).toBe(true);
    expect(
      dueToAsk({ until: askAgainAt(NOW) }, NOW + 3 * DAY),
    ).toBe(false);
    expect(
      dueToAsk({ until: askAgainAt(NOW) }, NOW + 3.2 * DAY),
    ).toBe(true);
    expect(dueToAsk({ done: true }, NOW + 100 * DAY)).toBe(
      false,
    );
  });
  it('waits for the page to settle, then offers Chrome’s prompt; a "Not now" snoozes it for π days', () => {
    const win = fakeWindow(UA.chrome);
    const ins = createInstall({
      win,
      now: () => NOW,
      askAfterMs: 6000,
    });
    ins.start();
    const e = promptEvent('accepted');
    win.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true); // Chrome's own mini-bar stays away
    expect(ins.state).toMatchObject({
      way: 'prompt',
      open: false,
    });
    vi.advanceTimersByTime(6000);
    expect(ins.state.open).toBe(true);
    ins.later();
    expect(ins.state.open).toBe(false);
    expect(store.get(INSTALL_KEY, {})).toEqual({
      until: NOW + 3.1415 * DAY,
    });
    ins.stop();
  });
  it('installs through the browser’s dialog, and stops asking', async () => {
    const win = fakeWindow(UA.chrome);
    const ins = createInstall({
      win,
      now: () => NOW,
      askAfterMs: 0,
    });
    ins.start();
    const e = promptEvent('accepted');
    win.dispatchEvent(e);
    vi.advanceTimersByTime(0);
    await ins.install();
    expect(e.prompt).toHaveBeenCalled();
    expect(store.get(INSTALL_KEY, {})).toEqual({
      done: true,
    });
  });
  it('counts a cancel in the browser’s dialog as "Not now"', async () => {
    const win = fakeWindow(UA.chrome);
    const ins = createInstall({
      win,
      now: () => NOW,
      askAfterMs: 0,
    });
    ins.start();
    win.dispatchEvent(promptEvent('dismissed'));
    vi.advanceTimersByTime(0);
    await ins.install();
    expect(store.get(INSTALL_KEY, {})).toEqual({
      until: NOW + 3.1415 * DAY,
    });
  });
  it('shows Safari’s steps on an iPhone, and stays quiet while snoozed or once installed', () => {
    let ins = createInstall({
      win: fakeWindow(UA.iphone),
      now: () => NOW,
      askAfterMs: 0,
    });
    ins.start();
    vi.advanceTimersByTime(0);
    expect(ins.state).toMatchObject({
      way: 'ios',
      open: true,
    });
    ins.later();
    // Two days later: still snoozed.
    ins = createInstall({
      win: fakeWindow(UA.iphone),
      now: () => NOW + 2 * DAY,
      askAfterMs: 0,
    });
    ins.start();
    vi.advanceTimersByTime(0);
    expect(ins.state.open).toBe(false);
    // Already on the Home Screen: never.
    store.set(INSTALL_KEY, {});
    ins = createInstall({
      win: fakeWindow(UA.iphone, { standalone: true }),
      now: () => NOW,
      askAfterMs: 0,
    });
    ins.start();
    vi.advanceTimersByTime(0);
    expect(ins.state.open).toBe(false);
  });
  it('never asks on a browser that can’t install (Firefox on a desktop)', () => {
    const ins = createInstall({
      win: fakeWindow(
        'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
      ),
      now: () => NOW,
      askAfterMs: 0,
    });
    ins.start();
    vi.advanceTimersByTime(0);
    expect(ins.state).toMatchObject({
      way: null,
      open: false,
    });
  });
  it('stops asking once the app is installed', () => {
    const win = fakeWindow(UA.chrome);
    const ins = createInstall({
      win,
      now: () => NOW,
      askAfterMs: 0,
    });
    ins.start();
    win.dispatchEvent(promptEvent('accepted'));
    vi.advanceTimersByTime(0);
    win.dispatchEvent(new Event('appinstalled'));
    expect(ins.state.open).toBe(false);
    expect(store.get(INSTALL_KEY, {})).toEqual({
      done: true,
    });
  });
});

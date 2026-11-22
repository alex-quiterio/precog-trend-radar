// PRECOG / Trend Radar · Installing PRECOG as an app. Chrome and Edge hand the page an install prompt
// (`beforeinstallprompt`) to show when it likes; Safari has none, so there the notice says how: Share › Add to
// Home Screen on an iPhone or iPad, File › Add to Dock on a Mac. A small notice asks once the page has settled;
// "Not now" hides it for π days (3.1415), "Done" or an install hides it for good, and an installed app never asks.
import { reactive } from 'vue';
import { DAY, store } from '@core/config';

export const INSTALL_KEY = 'precog.install.v1';
/** "Not now" asks again after this many days: π, near enough. */
export const SNOOZE_DAYS = 3.1415;
/** How long after opening the page the notice waits, so it never interrupts the first look. */
export const ASK_AFTER_MS = 6000;

/** How this browser installs an app: its own prompt, or the steps to follow in Safari. */
export type InstallWay = 'prompt' | 'ios' | 'mac-safari';
interface Saved {
  /** Ask again from this time on (ms). */
  until?: number;
  /** Installed, or the person said they added it: never ask again. */
  done?: boolean;
}
/** The prompt Chrome and Edge hand over (not in the DOM's own types yet). */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * The Safari way to install, from the user agent, or null. An iPad says it's a Mac, but has a touch screen.
 * Every browser on iOS can add to the Home Screen (they're all Safari underneath); on a Mac, Safari 17 or later.
 */
export function safariWay(ua: string, touchPoints: number): InstallWay | null {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return 'ios';
  const safari = /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|OPR/.test(ua);
  const version = Number(/Version\/(\d+)/.exec(ua)?.[1] ?? 0);
  return safari && version >= 17 ? 'mac-safari' : null;
}
/** True when it's time to ask: not done, and any "Not now" has run its π days. */
export const dueToAsk = (saved: Saved, now: number): boolean => !saved.done && (saved.until ?? 0) <= now;
/** When to ask again after a "Not now" at `now`. */
export const askAgainAt = (now: number): number => now + SNOOZE_DAYS * DAY;

export interface InstallDeps {
  win?: Window;
  now?: () => number;
  askAfterMs?: number;
}
/** The notice's state and actions. `start` listens for the browser's prompt and schedules the ask. */
export function createInstall({ win = window, now = Date.now, askAfterMs = ASK_AFTER_MS }: InstallDeps = {}) {
  const state = reactive({ way: null as InstallWay | null, open: false });
  let deferred: InstallPromptEvent | null = null;
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const saved = (): Saved => store.get<Saved>(INSTALL_KEY, {}) ?? {};
  const installed = () =>
    win.matchMedia?.('(display-mode: standalone)').matches ||
    (win.navigator as Navigator & { standalone?: boolean }).standalone === true;

  /** Opens the notice once the page has settled, if this browser can install and it's time to ask. */
  function maybeOpen(): void {
    if (settled && state.way && !installed() && dueToAsk(saved(), now())) state.open = true;
  }
  function onPrompt(e: Event): void {
    e.preventDefault(); // keep Chrome's own mini-bar away: the notice asks instead
    deferred = e as InstallPromptEvent;
    state.way = 'prompt';
    maybeOpen();
  }
  function onInstalled(): void {
    store.set(INSTALL_KEY, { done: true });
    state.open = false;
    deferred = null;
  }

  function start(): void {
    win.addEventListener('beforeinstallprompt', onPrompt);
    win.addEventListener('appinstalled', onInstalled);
    state.way = safariWay(win.navigator.userAgent, win.navigator.maxTouchPoints ?? 0);
    timer = setTimeout(() => {
      settled = true;
      maybeOpen();
    }, askAfterMs);
  }
  function stop(): void {
    win.removeEventListener('beforeinstallprompt', onPrompt);
    win.removeEventListener('appinstalled', onInstalled);
    clearTimeout(timer);
  }
  /** Chrome and Edge: shows the browser's own install dialog. A "cancel" there counts as "Not now". */
  async function install(): Promise<void> {
    if (!deferred) return;
    const e = deferred;
    deferred = null;
    state.open = false;
    await e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === 'accepted') store.set(INSTALL_KEY, { done: true });
    else later();
  }
  /** "Not now": hide it, and ask again in π days. */
  function later(): void {
    store.set(INSTALL_KEY, { until: askAgainAt(now()) });
    state.open = false;
  }
  /** Safari: the person says they added it. */
  function done(): void {
    store.set(INSTALL_KEY, { done: true });
    state.open = false;
  }
  return { state, start, stop, install, later, done };
}
export type Install = ReturnType<typeof createInstall>;

/** Registers the service worker that lets the installed app open offline (on the live site only). */
export function registerServiceWorker(win: Window = window): void {
  if (win.location.protocol !== 'https:' || !('serviceWorker' in win.navigator)) return;
  win.addEventListener(
    'load',
    () => void win.navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {}),
  );
}

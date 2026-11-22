// PRECOG / Trend Radar · Notifications when something new is pulled: a topic newly on alert (in any channel), or
// new posts from the sites you read (the Reading stream). They show only while PRECOG isn't the window you're
// looking at: a background tab, or the installed app in the background. PRECOG has no server, so nothing can
// arrive while it's closed. Off until you turn it on in Settings; the browser asks for permission then.
// Everything new is remembered as seen, notified or not, so turning notifications on (or the first visit) never
// replays old alerts.
import { reactive } from 'vue';
import { DAY, store } from '@core/config';
import type { Alert } from '@/types';

export const NOTIFY_KEY = 'precog.notify.v1';
export const SEEN_KEY = 'precog.notified.v1';
/** An alert older than this isn't news any more (data points are daily, published with a day's lag). */
const ALERT_FRESH_MS = 3 * DAY;
/** How long a seen item is remembered. */
const SEEN_KEEP_MS = 30 * DAY;

/** Something new, ready to tell. */
export interface NewThing {
  /** Stable across loads: the same alert or post twice is told once. */
  id: string;
  title: string;
  body: string;
  /** A short name for it in a summary of several ("NATO"). */
  name: string;
  /** The channel it belongs to, opened when the notification is clicked. */
  lensId?: string;
  /** The topic it belongs to, charted when the notification is clicked. */
  key?: string;
}
/** Why notifications can or can't be on, for Settings. */
export type NotifyState =
  'unsupported' | 'denied' | 'off' | 'on';

/** Alerts worth telling: recent ones only, one per topic, level and data point. */
export const alertThings = (
  alerts: Alert[],
  now: number,
): NewThing[] =>
  alerts
    .filter(a => now - a.t <= ALERT_FRESH_MS)
    .map(a => ({
      id: `alert:${a.key}:${a.t}:${a.level}`,
      title: `${a.topic} is ${a.level === 'alert' ? 'on alert' : 'on watch'} · ${a.lens}`,
      body: a.text,
      name: a.topic,
      lensId: a.lensId,
      key: a.key,
    }));
/** Several new things at once become one notification, so a busy load doesn't stack a dozen. */
export function summarise(
  fresh: NewThing[],
  noun: [string, string],
): NewThing | null {
  if (!fresh.length) {
    return null;
  }
  if (fresh.length === 1) {
    return fresh[0];
  }
  const names = fresh.slice(0, 3).map(t => t.name);
  return {
    id: fresh.map(t => t.id).join('|'),
    title: `${fresh.length} ${noun[1]}`,
    name: noun[1],
    body:
      names.join(', ') +
      (fresh.length > 3
        ? ` and ${fresh.length - 3} more`
        : ''),
    lensId: fresh[0].lensId,
    key: fresh.length === 1 ? fresh[0].key : undefined,
  };
}

export interface NotifierDeps {
  /** The browser window; left out (tests, no DOM), the notifier does nothing. */
  win?: Window;
  now?: () => number;
  /** Opens what a clicked notification is about. */
  onOpen?(target: { lensId?: string; key?: string }): void;
}
export function createNotifier({
  win,
  now = Date.now,
  onOpen,
}: NotifierDeps = {}) {
  const N =
    win && 'Notification' in win
      ? (win as Window & typeof globalThis).Notification
      : undefined;
  const supported = !!N;
  const permission = (): NotificationPermission =>
    N?.permission ?? 'denied';
  const state = reactive({
    on:
      !!store.get<{ on?: boolean }>(NOTIFY_KEY, {})?.on &&
      permission() === 'granted',
    /** The browser's answer, kept here so Settings updates when it changes. */
    permission: permission(),
  });
  const status = (): NotifyState =>
    !supported
      ? 'unsupported'
      : state.permission === 'denied'
        ? 'denied'
        : state.on
          ? 'on'
          : 'off';

  /** Turns notifications on, asking the browser for permission (call it from a click). */
  async function enable(): Promise<NotifyState> {
    if (!supported) {
      return 'unsupported';
    }
    const p =
      permission() === 'granted'
        ? 'granted'
        : await N!.requestPermission();
    state.permission = p;
    state.on = p === 'granted';
    store.set(NOTIFY_KEY, { on: state.on });
    return status();
  }
  function disable(): void {
    state.on = false;
    store.set(NOTIFY_KEY, { on: false });
  }

  /** The things not seen before, and marks them all seen. The first time ever, everything is just seen. */
  function fresh(things: NewThing[]): NewThing[] {
    const t = now();
    const seen = store.get<Record<string, number> | null>(
      SEEN_KEY,
      null,
    );
    const first = seen == null;
    const kept = Object.fromEntries(
      Object.entries(seen ?? {}).filter(
        ([, at]) => t - at < SEEN_KEEP_MS,
      ),
    );
    const out = first
      ? []
      : things.filter(x => !(x.id in kept));
    things.forEach(x => (kept[x.id] = kept[x.id] ?? t));
    store.set(SEEN_KEY, kept);
    return out;
  }
  /** Shows a notification, through the service worker when there is one (Android needs it), else directly. */
  async function show(x: NewThing): Promise<void> {
    if (
      !state.on ||
      permission() !== 'granted' ||
      win!.document.visibilityState === 'visible'
    ) {
      return;
    }
    const opts: NotificationOptions = {
      body: x.body,
      tag: x.id.slice(0, 120),
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      data: { lensId: x.lensId, key: x.key },
    };
    const reg = await win!.navigator.serviceWorker
      ?.getRegistration?.()
      .catch(() => undefined);
    if (reg) {
      return reg.showNotification(x.title, opts);
    }
    const n = new N!(x.title, opts);
    n.onclick = () => {
      win!.focus();
      onOpen?.({ lensId: x.lensId, key: x.key });
      n.close();
    };
  }
  /** After a load: tells topics newly on alert, in any channel. */
  function alerts(list: Alert[]): void {
    if (!supported) {
      return;
    }
    const x = summarise(fresh(alertThings(list, now())), [
      'topic on alert',
      'topics newly on alert or watch',
    ]);
    if (x) {
      void show(x);
    }
  }
  /** After the Reading stream loads: tells posts not seen before. */
  function posts(
    rows: { id: string; title: string; site?: string }[],
    lensId?: string,
  ): void {
    if (!supported) {
      return;
    }
    const things = rows.map(r => ({
      id: `post:${r.id}`,
      title: r.title,
      body: r.site ?? 'New to read',
      name: r.title,
      lensId,
    }));
    const x = summarise(fresh(things), [
      'new post',
      'new posts to read',
    ]);
    if (x) {
      void show(x);
    }
  }
  // A click on a notification the service worker showed comes back as a message.
  win?.navigator.serviceWorker?.addEventListener?.(
    'message',
    e => {
      if (e.data?.type === 'precog:open') {
        onOpen?.(e.data.target ?? {});
      }
    },
  );
  return {
    state,
    status,
    enable,
    disable,
    alerts,
    posts,
    supported,
  };
}
export type Notifier = ReturnType<typeof createNotifier>;

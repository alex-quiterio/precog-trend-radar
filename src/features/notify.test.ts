// Notifications when something new is pulled: what counts as new, when it shows, and what a click opens.
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { DAY } from '@core/config';
import { memoryBackend, useBackend } from '@core/storage';
import type { Alert } from '@/types';
import {
  alertThings,
  createNotifier,
  summarise,
} from './notify';

const NOW = Date.UTC(2026, 10, 22, 10);
const alert = (
  topic: string,
  daysAgo = 1,
  level: Alert['level'] = 'alert',
): Alert => ({
  id: 1,
  key: `world::${topic.toLowerCase()}`,
  lensId: 'world',
  lens: 'World',
  t: NOW - daysAgo * DAY,
  step: DAY,
  topic,
  color: '#000',
  z: 3,
  level,
  text: `${topic} attention is 3.0σ above its 30-step baseline.`,
});

/** A window with notifications: what was shown, whether the page is visible, and the permission it answers. */
function fakeWindow(
  opts: {
    permission?: NotificationPermission;
    answer?: NotificationPermission;
  } = {},
) {
  const shown: {
    title: string;
    body?: string;
    data?: unknown;
    click: () => void;
  }[] = [];
  const doc = {
    visibilityState: 'hidden' as DocumentVisibilityState,
  };
  class FakeNotification {
    static permission: NotificationPermission =
      opts.permission ?? 'granted';
    static requestPermission = vi.fn(
      async () =>
        (FakeNotification.permission =
          opts.answer ?? 'granted'),
    );
    onclick: (() => void) | null = null;
    constructor(title: string, o: NotificationOptions) {
      shown.push({
        title,
        body: o.body,
        data: o.data,
        click: () => this.onclick?.(),
      });
    }
    close() {}
  }
  const win = {
    Notification: FakeNotification,
    document: doc,
    navigator: {},
    focus: vi.fn(),
  } as unknown as Window;
  return { win, shown, doc, N: FakeNotification };
}

beforeEach(() => useBackend(memoryBackend()));

describe('what counts as news', () => {
  it('tells recent alerts only, each topic, level and day once', () => {
    const things = alertThings(
      [alert('NATO'), alert('Tariffs', 10)],
      NOW,
    );
    expect(things.map(t => t.title)).toEqual([
      'NATO is on alert · World',
    ]);
    expect(
      alertThings([alert('NATO', 1, 'watch')], NOW)[0].id,
    ).not.toBe(things[0].id); // a new level is news
  });
  it('rolls several into one notification', () => {
    const x = summarise(
      alertThings(
        [
          alert('NATO'),
          alert('Tariffs'),
          alert('Gaza war'),
          alert('AI'),
        ],
        NOW,
      ),
      ['topic on alert', 'topics newly on alert or watch'],
    );
    expect(x).toMatchObject({
      title: '4 topics newly on alert or watch',
      body: 'NATO, Tariffs, Gaza war and 1 more',
    });
  });
});

describe('the notifier', () => {
  async function on(
    w: ReturnType<typeof fakeWindow>,
    onOpen = vi.fn(),
  ) {
    const n = createNotifier({
      win: w.win,
      now: () => NOW,
      onOpen,
    });
    await n.enable();
    return { n, onOpen };
  }

  it('remembers what was there on the first run without telling it, then tells what is new', async () => {
    const w = fakeWindow();
    const { n } = await on(w);
    n.alerts([alert('NATO')]); // first run: just remembered
    expect(w.shown).toEqual([]);
    n.alerts([alert('NATO'), alert('Tariffs')]);
    await vi.waitFor(() =>
      expect(w.shown.map(s => s.title)).toEqual([
        'Tariffs is on alert · World',
      ]),
    );
    n.alerts([alert('NATO'), alert('Tariffs')]); // nothing new
    expect(w.shown).toHaveLength(1);
  });
  it('stays quiet while you are looking at the page, and doesn’t replay it later', async () => {
    const w = fakeWindow();
    const { n } = await on(w);
    n.alerts([]);
    w.doc.visibilityState = 'visible';
    n.alerts([alert('NATO')]);
    w.doc.visibilityState = 'hidden';
    n.alerts([alert('NATO')]);
    expect(w.shown).toEqual([]);
  });
  it('tells new posts from the sites you read', async () => {
    const w = fakeWindow();
    const { n } = await on(w);
    n.posts([{ id: 'a', title: 'Old episode' }], 'turning');
    n.posts(
      [
        { id: 'a', title: 'Old episode' },
        {
          id: 'b',
          title: 'Rules of the Downslope, Part 2',
          site: 'The Great Simplification',
        },
      ],
      'turning',
    );
    await vi.waitFor(() =>
      expect(w.shown[0]).toMatchObject({
        title: 'Rules of the Downslope, Part 2',
        body: 'The Great Simplification',
      }),
    );
  });
  it('opens the channel and topic a notification is about when clicked', async () => {
    const w = fakeWindow();
    const { n, onOpen } = await on(w);
    n.alerts([]);
    n.alerts([alert('NATO')]);
    await vi.waitFor(() => expect(w.shown).toHaveLength(1));
    w.shown[0].click();
    expect(onOpen).toHaveBeenCalledWith({
      lensId: 'world',
      key: 'world::nato',
    });
    expect(w.win.focus).toHaveBeenCalled();
  });
  it('shows nothing while off, and says so when the browser blocks it', async () => {
    const w = fakeWindow({
      permission: 'default',
      answer: 'denied',
    });
    const n = createNotifier({
      win: w.win,
      now: () => NOW,
    });
    expect(n.status()).toBe('off');
    n.alerts([]);
    n.alerts([alert('NATO')]);
    expect(w.shown).toEqual([]);
    expect(await n.enable()).toBe('denied');
    expect(n.status()).toBe('denied');
  });
  it('does nothing without a browser (tests, no DOM)', () => {
    const n = createNotifier();
    expect(n.status()).toBe('unsupported');
    expect(() => n.alerts([alert('NATO')])).not.toThrow();
  });
});

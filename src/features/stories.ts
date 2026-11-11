// PRECOG / Trend Radar · Streams under "Matched to your topics": what the streams look at (the topics in
// scope), and a loader that loads the stream on screen and keeps what is loading, what failed and when each
// stream last loaded. The app makes one loader (context.ts); the streams register in sources/<name>/stream.ts.
import { markRaw, reactive } from 'vue';
import { STORY_REFRESH_MS } from '@core/config';
import { errorText, isAbort } from '@core/errors';
import { streamsFor, type Stream, type StreamContext } from '@sources/streams';
import { activeChannel } from '@/channels';
import type { AppStore } from '@/state';
import type { Entry } from '@/types';

/** Streams look at the selected topic, or at every topic of the channel on screen. */
export function storyScopeEntries(app: AppStore): Entry[] {
  if (app.state.storyScope === 'topic') return [app.selectedEntry()].filter((E): E is Entry => !!E);
  return app.entriesOf(app.activeLens());
}
/** What the streams are looking at now. */
export function streamContext(app: AppStore, entries = storyScopeEntries(app)): StreamContext {
  return {
    entries,
    scopeKeys: new Set(entries.map(E => E.key)),
    scope: app.state.storyScope,
    sites: activeChannel(app).sites,
    now: app.ui.now,
    keys: { guardian: app.ui.guardian },
  };
}
/** The streams the channel on screen shows. */
export const channelStreams = (app: AppStore) => streamsFor(activeChannel(app).streams, streamContext(app));

export interface StoryDeps {
  /** The streams the channel on screen shows, in tab order. */
  shown(): Stream[];
  /** The stream on screen. */
  current(): string;
  /** Switches the stream on screen (when the channel doesn't show the current one). */
  select(id: string): void;
  /** What the streams look at now. */
  context(): StreamContext;
}
/**
 * Loads the stream on screen and keeps, per stream, whether it is loading, what failed and when it last
 * loaded. A newer load cancels an older one. Takes its world as arguments, so it can be tested alone.
 */
export function createStoryLoader(deps: StoryDeps) {
  const status = reactive({
    /** Each stream's last result, as its load returned it (passed back to its view). */
    data: {} as Record<string, unknown>,
    loading: {} as Record<string, boolean>,
    errors: {} as Record<string, string | null>,
    at: {} as Record<string, number>,
  });
  let abort: AbortController | null = null,
    /** The newest load, and the stream it is for (it may have finished). */
    latest: { src: string } | null = null,
    timer: ReturnType<typeof setInterval> | undefined;
  async function load(): Promise<void> {
    abort?.abort();
    abort = new AbortController();
    latest = null;
    const shown = deps.shown();
    if (!shown.some(s => s.id === deps.current())) deps.select(shown[0]?.id || 'reading');
    const stream = shown.find(s => s.id === deps.current());
    if (!stream) return;
    const { signal } = abort,
      src = stream.id;
    const mine = (latest = { src });
    status.loading[src] = true;
    try {
      const data = await stream.load(deps.context(), signal, partial => {
        if (!signal.aborted) status.data[src] = markRaw(Object(partial));
      });
      if (signal.aborted) return;
      status.data[src] = markRaw(Object(data));
      status.errors[src] = null;
      status.at[src] = Date.now();
    } catch (e) {
      if (!isAbort(e) && !signal.aborted) status.errors[src] = errorText(e);
    } finally {
      // A cancelled load leaves the flag to the load that replaced it, when that one is for the same stream.
      // Otherwise nothing else would clear it: coming back to this tab loads nothing if it has loaded before.
      if (latest === mine || latest?.src !== src) status.loading[src] = false;
    }
  }
  /** Reloads every `every` ms while the page is visible. */
  function startTimer(every = STORY_REFRESH_MS): void {
    clearInterval(timer);
    timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') void load();
    }, every);
  }
  return { status, load, startTimer };
}

// PRECOG / Trend Radar · Streams under "Matched to your topics": loads the stream on screen for the topics in
// scope, and keeps what is loading, what failed and when each stream last loaded. The streams themselves
// register in src/sources/<name>/stream.ts.
import { reactive } from 'vue';
import { STORY_REFRESH_MS } from '@core/config';
import { errorText, isAbort } from '@core/errors';
import { streamsFor, type Stream, type StreamContext } from '@sources/streams';
import { activeChannel } from '@/channels';
import { activeLens, entriesOf, selectedEntry, state } from '@/state';
import type { Entry } from '@/types';

/** Streams look at the selected topic, or at every topic of the channel on screen. */
export function storyScopeEntries(): Entry[] {
  if (state.storyScope === 'topic') return [selectedEntry()].filter((E): E is Entry => !!E);
  return entriesOf(activeLens());
}
/** What the streams are looking at now. */
export function streamContext(entries = storyScopeEntries()): StreamContext {
  return {
    entries,
    scopeKeys: new Set(entries.map(E => E.key)),
    scope: state.storyScope,
    sites: activeChannel().sites,
  };
}
/** The streams the channel on screen shows. */
export const channelStreams = () => streamsFor(activeChannel().streams);

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
    loading: {} as Record<string, boolean>,
    errors: {} as Record<string, string | null>,
    at: {} as Record<string, number>,
  });
  let abort: AbortController | null = null,
    timer: ReturnType<typeof setInterval> | undefined;
  async function load(): Promise<void> {
    abort?.abort();
    abort = new AbortController();
    const shown = deps.shown();
    if (!shown.some(s => s.id === deps.current())) deps.select(shown[0]?.id || 'reading');
    const stream = shown.find(s => s.id === deps.current());
    if (!stream) return;
    const { signal } = abort,
      src = stream.id;
    status.loading[src] = true;
    try {
      await stream.load(deps.context(), signal);
      if (signal.aborted) return;
      status.errors[src] = null;
      status.at[src] = Date.now();
    } catch (e) {
      if (!isAbort(e) && !signal.aborted) status.errors[src] = errorText(e);
    } finally {
      // A cancelled load leaves the flag to the load that replaced it, unless that one is another stream's.
      if (!signal.aborted || deps.current() !== src) status.loading[src] = false;
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

/** The app's stream loader, looking at the channel on screen. */
const loader = createStoryLoader({
  shown: () => channelStreams(),
  current: () => state.storySrc,
  select: id => void (state.storySrc = id),
  context: () => streamContext(),
});
export const stories = loader.status;
export const loadStories = loader.load;
export const startStoryTimer = loader.startTimer;

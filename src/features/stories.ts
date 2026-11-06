// PRECOG / Trend Radar · Streams under "Matched to your topics": loads the stream on screen for the topics in
// scope, and keeps what is loading, what failed and when each stream last loaded. The streams themselves
// register in src/sources/<name>/stream.ts.
import { reactive } from 'vue';
import { STORY_REFRESH_MS } from '@core/config';
import { errorText, isAbort } from '@core/errors';
import { streamById, streamsFor, type StreamContext } from '@sources/streams';
import { activeChannel } from '@/channels';
import { activeLens, entriesOf, selectedEntry, state } from '@/state';
import type { Entry } from '@/types';

export const stories = reactive({
  loading: {} as Record<string, boolean>,
  errors: {} as Record<string, string | null>,
  at: {} as Record<string, number>,
});
let storyTimer: ReturnType<typeof setInterval> | undefined,
  storyAbort: AbortController | null = null;

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

/** Loads the stream on screen (switching to the channel's first one if it doesn't show the current one). */
export async function loadStories(): Promise<void> {
  if (storyAbort) storyAbort.abort();
  storyAbort = new AbortController();
  const shown = channelStreams();
  if (!shown.some(s => s.id === state.storySrc)) state.storySrc = shown[0]?.id || 'reading';
  const stream = streamById(state.storySrc);
  if (!stream) return;
  const { signal } = storyAbort,
    src = stream.id;
  stories.loading[src] = true;
  try {
    await stream.load(streamContext(), signal);
    stories.errors[src] = null;
    stories.at[src] = Date.now();
  } catch (e) {
    if (!isAbort(e)) stories.errors[src] = errorText(e);
  }
  stories.loading[src] = false;
}
export function startStoryTimer(): void {
  clearInterval(storyTimer);
  storyTimer = setInterval(() => {
    if (document.visibilityState === 'visible') loadStories();
  }, STORY_REFRESH_MS);
}

// PRECOG / Trend Radar · The composition root: makes the app store and the services that work on it (the
// data loop, the stream loader, the actions), and hands them to every panel through Vue's provide/inject.
// Panels call useApp() instead of importing shared state, so a test can mount any panel with its own context.
import { inject, type App, type InjectionKey } from 'vue';
import { rescanAll } from '@/alerts';
import { createActions } from '@/actions';
import { createLiveLoop } from '@/live';
import { createAppStore, type AppStore } from '@/state';
import { ui } from '@core/ui-store';
import { channelStreams, createStoryLoader, streamContext } from '@features/stories';
import { ADAPTERS, SOURCES } from '@sources/registry';

export function createContext(app: AppStore = createAppStore()) {
  const stories = createStoryLoader({
    shown: () => channelStreams(app),
    current: () => app.state.storySrc,
    select: id => void (app.state.storySrc = id),
    context: () => streamContext(app),
  });
  const live = createLiveLoop({
    adapters: ADAPTERS,
    sources: SOURCES,
    state: app.state,
    ui,
    entries: app.orderedEntries, // the channel on screen first
    onLoadStart: () => void stories.load(),
    onLoaded: () => rescanAll(app),
  });
  const actions = createActions(app, { live, stories });
  return { app, live, stories, actions };
}
export type AppContext = ReturnType<typeof createContext>;

const KEY: InjectionKey<AppContext> = Symbol('precog');
/** A Vue plugin that provides the context to every component (`app.use(contextPlugin(ctx))`). */
export const contextPlugin = (ctx: AppContext) => ({ install: (vue: App) => void vue.provide(KEY, ctx) });
/** The context, inside a component's setup. */
export function useApp(): AppContext {
  const ctx = inject(KEY);
  if (!ctx) throw new Error('useApp() needs the context: install contextPlugin(createContext()) on the app');
  return ctx;
}

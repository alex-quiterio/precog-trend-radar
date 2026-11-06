// PRECOG / Trend Radar · Start-up: what the last visit left behind (theme, channel, topic, stream), checked
// before use, and the caches older versions wrote, dropped to free storage.
import { LS, store } from '@core/config';
import { dropKeys } from '@core/storage';
import { ui } from '@core/ui-store';
import { githubToken } from '@sources/github/auth';
import { guardianKey } from '@sources/guardian';
import type { AppContext } from '@/context';
import type { Prefs } from '@/types';

/** Caches written by earlier versions (GDELT, old Reading and Guardian formats), no longer read. */
export const OLD_CACHES = /^precog\.(gdelt|reading\.v[12]\.|guardian\.v1\.|tgs\.|rss\.)/;

/** Restores the lenses and the last view from storage; anything unusable falls back to a default. */
export function restore({ app, actions }: AppContext): void {
  const { state } = app;
  dropKeys(OLD_CACHES);
  const prefs = store.get<Partial<Prefs>>(LS.prefs, {});
  actions.applyTheme(prefs.theme || 'dark');
  app.loadLenses();
  ui.guardian = !!guardianKey();
  ui.ghToken = !!githubToken();
  state.activeLens = (app.lensById(prefs.activeLens) && prefs.activeLens) || state.lenses[0]?.id || null;
  state.selectedByLens = prefs.selectedByLens && typeof prefs.selectedByLens === 'object' ? prefs.selectedByLens : {};
  // A stream id; loading the streams switches to the channel's first one if this one isn't shown.
  state.storySrc = typeof prefs.storySrc === 'string' ? prefs.storySrc : 'reading';
  state.storyScope = prefs.storyScope === 'topic' ? 'topic' : 'lens';
  state.prevLook = store.get(LS.look, null);
}

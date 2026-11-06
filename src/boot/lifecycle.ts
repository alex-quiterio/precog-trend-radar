// PRECOG / Trend Radar · The page coming and going: catch up when it comes back after an hour away, and
// remember what you saw (for "since your last look") when you leave after a real look (20 s or more).
import { HOUR } from '@core/config';
import { saveLook } from '@features/brief';
import type { AppContext } from '@/context';

const LOOKED = 20e3;
export function installLifecycle({ app, live }: AppContext): void {
  const { state } = app;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - live.updated() > HOUR) void live.load();
    if (document.visibilityState === 'hidden' && Date.now() - state.viewStart > LOOKED) saveLook(app);
  });
  window.addEventListener('pagehide', () => {
    if (Date.now() - state.viewStart > LOOKED) saveLook(app);
  });
}

// PRECOG / Trend Radar · Boot: restore prefs, mount the Vue app, start the data loop, global keys.
import { createApp } from 'vue';
import '@/styles/tokens.css';
import '@/styles/app.css';
import '@/styles/print-motion.css';

// Every source registers itself on import: trend sources, streams and open-data cards.
import '@sources/index';

import App from '@/App.vue';
import StateTag from '@components/StateTag.vue';
import TopicDot from '@components/TopicDot.vue';
import { applyTheme, selectLens, shiftLens, shiftTopic } from '@/actions';
import { HOUR, LS, store } from '@core/config';
import { ago, changeLabel, fmtAxis, fmtPct, fmtTick, fmtTime, fmtVal, nf0, nf1 } from '@core/format';
import { looksLikePerson } from '@core/guard';
import { arrowOf, levelOf } from '@core/stats';
import { startClock, ui } from '@core/ui-store';
import { loadDatapoints } from '@features/datapoints';
import { loadGitHub } from '@features/github';
import { loadMyGitHub } from '@features/github-me';
import { activeChannel, channels } from '@/channels';
import { saveLook } from '@features/brief';
import { startStoryTimer } from '@features/stories';
import { liveUpdated, loadLive, startLive } from '@/live';
import { ADAPTERS, registerAdapter } from '@sources/registry';
import { guardianKey } from '@sources/guardian';
import { githubToken } from '@sources/github/auth';
import { lensById, loadLenses, state } from '@/state';
import type { Prefs } from '@/types';

/** Removes caches written by earlier versions (GDELT, old Reading and Guardian formats) to free storage. */
function dropOldCaches(): void {
  try {
    Object.keys(localStorage)
      .filter(k => /^precog\.(gdelt|reading\.v[12]\.|guardian\.v1\.|tgs\.|rss\.)/.test(k))
      .forEach(k => localStorage.removeItem(k));
  } catch {
    /* storage unavailable */
  }
}

function boot(): void {
  dropOldCaches();
  const prefs = store.get<Partial<Prefs>>(LS.prefs, {});
  applyTheme(prefs.theme || 'dark');
  loadLenses();
  ui.guardian = !!guardianKey();
  ui.ghToken = !!githubToken();
  state.activeLens = (lensById(prefs.activeLens) && prefs.activeLens) || state.lenses[0]?.id || null;
  state.selectedByLens = prefs.selectedByLens && typeof prefs.selectedByLens === 'object' ? prefs.selectedByLens : {};
  // A stream id; loadStories switches to the channel's first stream if this one isn't shown.
  state.storySrc = typeof prefs.storySrc === 'string' ? prefs.storySrc : 'reading';
  state.storyScope = prefs.storyScope === 'topic' ? 'topic' : 'lens';
  state.prevLook = store.get(LS.look, null);

  const app = createApp(App);
  Object.assign(app.config.globalProperties, {
    fmtVal,
    fmtPct,
    fmtTime,
    fmtTick,
    fmtAxis,
    ago,
    arrowOf,
    levelOf,
    changeLabel,
    nf0,
    nf1,
  });
  app.component('StateTag', StateTag);
  app.component('TopicDot', TopicDot);
  app.mount('#app');

  startClock();
  startLive();
  if (activeChannel().github) loadGitHub();
  loadMyGitHub();
  loadDatapoints();
  setInterval(loadDatapoints, HOUR);
  startStoryTimer();
}

document.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const target = e.target instanceof Element ? e.target : document.body;
  if (target.closest('input, textarea, select, [contenteditable], dialog, .grip')) return;
  // 1–9 jump to that channel, in channel-bar order.
  if (/^[1-9]$/.test(e.key) && !e.shiftKey) {
    const c = channels()[+e.key - 1];
    if (!c) return;
    e.preventDefault();
    selectLens(c.lensId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (e.key === '[' || e.key === ']') {
    e.preventDefault();
    shiftLens(e.key === ']' ? 1 : -1);
    return;
  }
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.shiftKey && !target.closest('.table-scroll')) {
    e.preventDefault();
    shiftTopic(e.key === 'ArrowRight' ? 1 : -1);
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - liveUpdated > HOUR) loadLive();
  if (document.visibilityState === 'hidden' && Date.now() - state.viewStart > 20e3) saveLook();
});
window.addEventListener('pagehide', () => {
  if (Date.now() - state.viewStart > 20e3) saveLook();
});

// Public hooks: add your own data source from the browser console or a <script> (see README).
declare global {
  interface Window {
    PRECOG: unknown;
  }
}
window.PRECOG = { registerAdapter, adapters: ADAPTERS, looksLikePerson };

boot();

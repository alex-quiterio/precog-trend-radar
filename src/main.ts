// PRECOG / Trend Radar · Boot: restore prefs, mount the Vue app, start the data loop, global keys.
import { createApp } from 'vue';
import './styles/tokens.css';
import './styles/app.css';
import './styles/print-motion.css';

// Data sources register themselves on import, in this order (it is the order of the source menu).
import './sources/wikipedia';
import './sources/hackernews';
import './sources/gdelt';
import './sources/github';
import './sources/rss';

import App from './App.vue';
import StateTag from './components/StateTag.vue';
import TopicDot from './components/TopicDot.vue';
import { applyTheme, shiftLens, shiftTopic } from './actions';
import { HOUR, LS, store } from './core/config';
import { ago, changeLabel, fmtAxis, fmtPct, fmtTick, fmtTime, fmtVal, nf0, nf1 } from './core/format';
import { looksLikePerson } from './core/guard';
import { arrowOf, levelOf } from './core/stats';
import { bump } from './core/ui-store';
import { loadDatapoints } from './features/datapoints';
import { saveLook } from './features/brief';
import { startStoryTimer } from './features/stories';
import { loadLayout } from './layout';
import { DEFAULT_SOURCE, liveUpdated, loadLive, setSource } from './live';
import { ADAPTERS, SOURCES, registerAdapter } from './sources/registry';
import { lensById, loadLenses, state } from './state';
import type { Prefs } from './types';

function boot(): void {
  const prefs = store.get<Partial<Prefs>>(LS.prefs, {});
  applyTheme(prefs.theme || 'dark');
  loadLenses();
  loadLayout();
  state.activeLens = lensById(prefs.activeLens) ? prefs.activeLens : state.lenses[0]?.id || null;
  state.selectedByLens = prefs.selectedByLens && typeof prefs.selectedByLens === 'object' ? prefs.selectedByLens : {};
  state.tableView = !!prefs.tableView;
  state.includeNews = prefs.includeNews !== false;
  state.storySrc = ['news', 'local', 'tgs'].includes(prefs.storySrc) ? prefs.storySrc : 'hn';
  state.storyScope = prefs.storyScope === 'topic' || prefs.storyScope === 'lens' ? prefs.storyScope : 'all';
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

  // 'demo' was a source before the simulator was removed; anything unknown falls back to the attention index.
  let startSource = prefs.source && SOURCES[prefs.source] ? prefs.source : DEFAULT_SOURCE;
  if (startSource === 'rss' && !store.get(LS.rss, { feeds: [] as string[] }).feeds.length) startSource = DEFAULT_SOURCE;
  setSource(startSource);
  loadDatapoints();
  setInterval(loadDatapoints, HOUR);
  startStoryTimer();
}

document.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const target = e.target instanceof Element ? e.target : document.body;
  if (target.closest('input, textarea, select, [contenteditable], dialog, .grip')) return;
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
window.addEventListener('beforeprint', bump);
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
window.PRECOG = { registerAdapter, adapters: ADAPTERS, looksLikePerson, useSource: (id: string) => setSource(id) };

boot();

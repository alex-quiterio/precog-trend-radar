// PRECOG / Trend Radar · Data loop: demo ticks, live fetching, source switching.
import { openFeeds } from './actions';
import { evaluate, pushAlert, rescanAll } from './alerts';
import { HISTORY, HOUR, LIVE_REFRESH_MS, LS, TICK_MS, store } from './core/config';
import { fmtTime } from './core/format';
import { simStep } from './core/sim';
import { computeStats } from './core/stats';
import { bump, ui } from './core/ui-store';
import { loadStories } from './features/stories';
import { blendParts } from './sources/blend';
import { ADAPTERS, SOURCES, pool, queryOf } from './sources/registry';
import { activeLens, allEntries, entriesOf, savePrefs, state } from './state';

export let tickTimer = null,
  liveTimer = null,
  liveAbort = null,
  liveUpdated = 0,
  renderQueued = false;
export function setStatus(msg) {
  ui.status = msg || '';
}
export function beat(text) {
  ui.pulse = text;
  ui.beat++;
}
export function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    bump();
  });
}
export const liveParts = () =>
  (SOURCES[state.source]?.parts || []).filter(
    p => ADAPTERS[p] && !(p === 'news' && SOURCES[state.source].blend && !state.includeNews),
  );

export function recompute(E) {
  const src = SOURCES[state.source],
    parts = liveParts();
  E.liveSeries = src.blend ? blendParts(E, parts) : E.parts[parts[0]] || [];
  const errs = parts.map(p => E.partErr[p]).filter(Boolean);
  E.liveError = E.liveSeries.length ? null : errs.length === parts.length ? errs[0] : null;
  E.stats = computeStats(E.liveSeries);
}
export async function fetchPart(E, pid, signal) {
  try {
    const res = await ADAPTERS[pid].fetch(E.name, {
      signal,
      query: queryOf(E),
      config: { rss: store.get(LS.rss, { feeds: [], proxy: '' }) },
    });
    if (signal.aborted) return;
    if (res.skip) {
      E.parts[pid] = null;
      E.partErr[pid] = null;
      E.skipped = E.skipped || {};
      E.skipped[pid] = res.skip;
      recompute(E);
      return;
    }
    E.parts[pid] = (res.points || [])
      .map(p => ({ t: typeof p.t === 'number' ? p.t : Date.parse(p.t), value: +p.value }))
      .filter(p => isFinite(p.t) && isFinite(p.value))
      .sort((a, b) => a.t - b.t)
      .slice(-HISTORY);
    E.partErr[pid] = E.parts[pid].length ? null : 'no data returned';
    if (res.meta) Object.assign(E.meta, res.meta);
  } catch (e) {
    if (e.name === 'AbortError') return;
    E.parts[pid] = null;
    E.partErr[pid] = e.message || String(e);
  }
  recompute(E);
}
export function orderedEntries() {
  const a = activeLens();
  return [...entriesOf(a), ...state.lenses.filter(l => l !== a).flatMap(entriesOf)];
}
export async function loadLive() {
  const parts = liveParts();
  if (!parts.length) return;
  if (liveAbort) liveAbort.abort();
  liveAbort = new AbortController();
  const { signal } = liveAbort;
  const entries = orderedEntries();
  const total = entries.length * parts.length;
  let done = 0;
  const note = parts.includes('news')
    ? ' Global news (GDELT) allows one request every ~5 s, so it fills in last; results are cached for the day.'
    : parts.includes('github')
      ? ' GitHub allows ~10 searches a minute; results are cached.'
      : '';
  setStatus(`Fetching ${SOURCES[state.source].label}… 0/${total}.${note}`);
  loadStories();
  await Promise.all(
    parts.map(pid =>
      pool(entries, ADAPTERS[pid].concurrency || 4, async E => {
        if (signal.aborted) return;
        await fetchPart(E, pid, signal);
        done++;
        if (!signal.aborted) {
          setStatus(`Fetching ${SOURCES[state.source].label}… ${done}/${total}.${note}`);
          scheduleRender();
        }
      }),
    ),
  );
  if (signal.aborted) return;
  liveUpdated = Date.now();
  state.liveLoaded = true;
  rescanAll();
  bump();
  beat(`updated ${new Date(liveUpdated).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`);
  const all = allEntries(),
    failed = all.filter(E => E.liveError),
    partial = all.filter(E => !E.liveError && parts.some(p => E.partErr[p]));
  if (all.length && failed.length === all.length) {
    const why = failed[0].liveError;
    setSource('demo');
    setStatus(`Live source failed (${why}). Back on DEMO DATA.`);
    return;
  }
  const newsDown = parts.includes('news') && all.every(E => E.partErr.news);
  setStatus(
    `LIVE · ${SOURCES[state.source].label}. Refreshes every 30 min.` +
      (newsDown ? ' Global news (GDELT) did not answer, so the index uses the other sources.' : '') +
      (partial.length
        ? ' Missing: ' +
          parts
            .map(p => [p, all.filter(E => E.partErr[p]).length] as [string, number])
            .filter(([, n]) => n)
            .map(
              ([p, n]) =>
                `${ADAPTERS[p].label.split(' ')[0] === 'Global' ? 'GDELT' : ADAPTERS[p].label.replace(/ \/.*$| posts| stories| pageviews/g, '')} for ${n} topic${n > 1 ? 's' : ''}`,
            )
            .join(', ') +
          '.'
        : '') +
      (failed.length ? ` No data for: ${failed.map(E => `${E.name} (${E.liveError})`).join('; ')}.` : ''),
  );
}

export function demoTick() {
  state.simNow += HOUR;
  allEntries().forEach(E => {
    E.simSeries.push({ t: state.simNow, value: simStep(E.sim) });
    if (E.simSeries.length > HISTORY) E.simSeries.shift();
    E.stats = computeStats(E.simSeries);
    const a = evaluate(E, E.stats);
    if (a) pushAlert(a);
  });
  beat(`tick · ${fmtTime(state.simNow, HOUR)} (simulated)`);
  bump();
}
export function stopLive() {
  if (liveAbort) liveAbort.abort();
  liveAbort = null;
  clearInterval(liveTimer);
  liveTimer = null;
}
export function startDemo() {
  stopLive();
  state.mode = 'demo';
  state.source = 'demo';
  allEntries().forEach(E => {
    E.stats = computeStats(E.simSeries);
  });
  rescanAll();
  clearInterval(tickTimer);
  tickTimer = setInterval(demoTick, TICK_MS);
  setStatus('Simulated random walks with injected spikes. 1 tick = 1 simulated hour, a new point every 2 s.');
  beat(`tick · ${fmtTime(state.simNow, HOUR)} (simulated)`);
  bump();
}
export function startLive() {
  clearInterval(tickTimer);
  tickTimer = null;
  state.mode = 'live';
  state.liveLoaded = false;
  allEntries().forEach(E => {
    E.parts = {};
    E.partErr = {};
    E.liveSeries = [];
    E.liveError = null;
    E.stats = null;
  });
  state.alerts = [];
  beat('connecting…');
  bump();
  loadLive();
  clearInterval(liveTimer);
  liveTimer = setInterval(loadLive, LIVE_REFRESH_MS);
}
export function setSource(id) {
  if (!SOURCES[id]) id = 'demo';
  state.source = id;
  savePrefs();
  if (id === 'demo') return startDemo();
  if (id === 'rss' && !store.get(LS.rss, { feeds: [] }).feeds.length) {
    openFeeds('source');
    bump();
    return;
  }
  startLive();
}

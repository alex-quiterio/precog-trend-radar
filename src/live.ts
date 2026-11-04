// PRECOG / Trend Radar · Data loop: live fetching, refresh, source switching.
import { rescanAll } from './alerts';
import { HISTORY, LIVE_REFRESH_MS } from './core/config';
import { computeStats } from './core/stats';
import { bump, ui } from './core/ui-store';
import { loadStories } from './features/stories';
import { blendParts } from './sources/blend';
import { ADAPTERS, SOURCES, pool, queryOf } from './sources/registry';
import { activeLens, allEntries, entriesOf, state } from './state';

export const DEFAULT_SOURCE = 'blend';
export let liveTimer = null,
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
export const liveParts = () => (SOURCES[state.source]?.parts || []).filter(p => ADAPTERS[p]);

export function recompute(E) {
  const src = SOURCES[state.source],
    parts = liveParts();
  E.liveSeries = src.blend ? blendParts(E, parts) : E.parts[parts[0]] || [];
  const errs = parts.map(p => E.partErr[p] || E.skipped?.[p]).filter(Boolean);
  E.liveError = E.liveSeries.length ? null : errs.length === parts.length ? errs[0] : null;
  E.stats = computeStats(E.liveSeries);
}
export async function fetchPart(E, pid, signal) {
  try {
    const res = await ADAPTERS[pid].fetch(E.name, { signal, query: queryOf(E) });
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
    if (E.skipped) delete E.skipped[pid];
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
  ui.loading = true;
  setStatus(`Fetching attention data… 0/${total}`);
  loadStories();
  await Promise.all(
    parts.map(pid =>
      pool(entries, ADAPTERS[pid].concurrency || 4, async E => {
        if (signal.aborted) return;
        await fetchPart(E, pid, signal);
        done++;
        if (!signal.aborted) {
          setStatus(`Fetching attention data… ${done}/${total}`);
          scheduleRender();
        }
      }),
    ),
  );
  if (signal.aborted) return;
  ui.loading = false;
  liveUpdated = Date.now();
  state.liveLoaded = true;
  rescanAll();
  bump();
  beat(`updated ${new Date(liveUpdated).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`);
  const all = allEntries(),
    failed = all.filter(E => E.liveError),
    partial = all.filter(E => !E.liveError && parts.some(p => E.partErr[p]));
  if (all.length && failed.length === all.length) {
    ui.offline = true;
    setStatus(`Couldn't reach any source (${failed[0].liveError}). Check your connection, then press ↻ Refresh.`);
    return;
  }
  ui.offline = false;
  const short = (p: string) => ADAPTERS[p].label.replace(/ (articles|stories|pageviews) \/ day$/, '');
  setStatus(
    `Live · updated ${new Date(liveUpdated).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} · refreshes every 30 min.` +
      (partial.length
        ? ' Missing: ' +
          parts
            .map(p => [p, all.filter(E => E.partErr[p]).length] as [string, number])
            .filter(([, n]) => n)
            .map(([p, n]) => `${short(p)} for ${n} topic${n > 1 ? 's' : ''}`)
            .join(', ') +
          '.'
        : '') +
      (failed.length ? ` No data for: ${failed.map(E => `${E.name} (${E.liveError})`).join('; ')}.` : ''),
  );
}

export function stopLive() {
  if (liveAbort) liveAbort.abort();
  liveAbort = null;
  clearInterval(liveTimer);
  liveTimer = null;
}
export function startLive() {
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
/** Fetch again now, keeping what's on screen until new data arrives. */
export function refresh() {
  if (!ui.loading) loadLive();
}

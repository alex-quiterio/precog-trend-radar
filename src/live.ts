// PRECOG / Trend Radar · The data loop: fetches every topic from every trend source, keeps what's on screen
// until new data arrives, refreshes on a timer, and reports progress and failures in the status line.
// createLiveLoop takes everything it touches as arguments, so it can be tested with fake sources;
// the app makes one (context.ts).
import { markRaw } from 'vue';
import { HISTORY, LIVE_REFRESH_MS } from '@core/config';
import { errorText, isAbort } from '@core/errors';
import { computeStats } from '@core/stats';
import { blendParts } from '@sources/blend';
import { pool, queryOf } from '@sources/registry';
import type { Adapter, Alert, Entry, Source } from '@/types';

/** The UI fields the loop reports into. */
export interface LoopUi {
  status: string;
  pulse: string;
  beat: number;
  loading: boolean;
  offline: boolean;
  guardian: boolean;
  guardianState: 'off' | 'checking' | 'ok' | 'error';
  guardianNote: string;
}
export interface LoopDeps {
  adapters: Record<string, Adapter>;
  sources: Record<string, Source>;
  /** Which source is charted, whether a first load finished, and the alerts the loop clears on restart. */
  state: { source: string; liveLoaded: boolean; alerts: Alert[] };
  ui: LoopUi;
  /** Every topic, the channel on screen first (fetched first). */
  entries(): Entry[];
  /** Called as a load starts (the app loads the stream on screen alongside). */
  onLoadStart?(): void;
  /** Called once a load finished (the app rescans for alerts). */
  onLoaded?(): void;
  /** How often to refresh, in ms. */
  every?: number;
}
const hhmm = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export function createLiveLoop(deps: LoopDeps) {
  const { adapters, sources, state, ui } = deps;
  let timer: ReturnType<typeof setInterval> | undefined,
    abort: AbortController | null = null,
    updated = 0;

  const setStatus = (msg: string): void => void (ui.status = msg || '');
  const beat = (text: string): void => {
    ui.pulse = text;
    ui.beat++;
  };
  /** The trend sources feeding the charted series that are registered. */
  const parts = (): string[] => (sources[state.source]?.parts || []).filter(p => adapters[p]);

  /** Rebuilds a topic's series and stats from its parts. */
  function recompute(E: Entry): void {
    const src = sources[state.source],
      ps = parts();
    E.liveSeries = markRaw(src?.blend ? blendParts(E, ps, adapters) : E.parts[ps[0]] || []);
    const errs = ps.map(p => E.partErr[p] || E.skipped?.[p]).filter((e): e is string => !!e);
    E.liveError = E.liveSeries.length ? null : errs.length === ps.length ? errs[0] : null;
    const st = computeStats(E.liveSeries);
    E.stats = st && markRaw(st);
  }
  /** Fetches one topic from one source. Never throws: a failure is kept on the topic, per source. */
  async function fetchPart(E: Entry, pid: string, signal: AbortSignal): Promise<void> {
    try {
      const res = await adapters[pid].fetch(E.name, { signal, query: queryOf(E) });
      if (signal.aborted) return;
      if (res.skip) {
        E.parts[pid] = null;
        E.partErr[pid] = null;
        E.skipped = { ...E.skipped, [pid]: res.skip };
        recompute(E);
        return;
      }
      E.parts[pid] = markRaw(
        (res.points || [])
          .map(p => ({ t: typeof p.t === 'number' ? p.t : Date.parse(p.t), value: +p.value }))
          .filter(p => isFinite(p.t) && isFinite(p.value))
          .sort((a, b) => a.t - b.t)
          .slice(-HISTORY),
      );
      E.partErr[pid] = E.parts[pid].length ? null : 'no data returned';
      if (E.skipped) delete E.skipped[pid];
      if (res.meta) Object.assign(E.meta, res.meta);
    } catch (e) {
      if (isAbort(e)) return;
      E.parts[pid] = null;
      E.partErr[pid] = errorText(e);
    }
    recompute(E);
  }
  /** Fetches everything. A newer load cancels an older one still running. */
  async function load(): Promise<void> {
    const ps = parts();
    if (!ps.length) return;
    abort?.abort();
    abort = new AbortController();
    const { signal } = abort;
    const entries = deps.entries();
    const total = entries.length * ps.length;
    let done = 0;
    ui.loading = true;
    if (ui.guardian) Object.assign(ui, { guardianState: 'checking', guardianNote: 'Counting Guardian articles…' });
    setStatus(`Fetching attention data… 0/${total}`);
    deps.onLoadStart?.();
    await Promise.all(
      ps.map(pid =>
        pool(entries, adapters[pid].concurrency || 4, async E => {
          if (signal.aborted) return;
          await fetchPart(E, pid, signal);
          done++;
          if (!signal.aborted) setStatus(`Fetching attention data… ${done}/${total}`);
        }),
      ),
    );
    if (signal.aborted) return;
    abort = null; // finished: nothing is running now
    ui.loading = false;
    updated = Date.now();
    state.liveLoaded = true;
    deps.onLoaded?.();
    reportGuardian(entries);
    beat(`updated ${hhmm(updated)}`);
    report(entries, ps);
  }
  /** The status line after a load: all good, partly missing, or nothing reachable. */
  function report(all: Entry[], ps: string[]): void {
    const failed = all.filter(E => E.liveError),
      partial = all.filter(E => !E.liveError && ps.some(p => E.partErr[p]));
    if (all.length && failed.length === all.length) {
      ui.offline = true;
      setStatus(`Couldn't reach any source (${failed[0].liveError}). Check your connection, then press ↻ Refresh.`);
      return;
    }
    ui.offline = false;
    const short = (p: string) => adapters[p].label.replace(/ (articles|stories|pageviews) \/ day$/, '');
    const missing = ps
      .map(p => [p, all.filter(E => E.partErr[p]).length] as const)
      .filter(([, n]) => n)
      .map(([p, n]) => `${short(p)} for ${n} topic${n > 1 ? 's' : ''}`);
    setStatus(
      `Live · updated ${hhmm(updated)} · refreshes every 30 min.` +
        (partial.length ? ` Missing: ${missing.join(', ')}.` : '') +
        (failed.length ? ` No data for: ${failed.map(E => `${E.name} (${E.liveError})`).join('; ')}.` : ''),
    );
  }
  /** Tells the header whether the Guardian key is working: how many topics got articles, or why not. */
  function reportGuardian(all: Entry[]): void {
    if (!ui.guardian) return void Object.assign(ui, { guardianState: 'off', guardianNote: '' });
    const ok = all.filter(E => E.parts.guardian?.length).length;
    const err = all.map(E => E.partErr.guardian).find(Boolean);
    const articles = all.reduce((a, E) => a + (E.parts.guardian || []).reduce((b, p) => b + p.value, 0), 0);
    Object.assign(
      ui,
      ok
        ? {
            guardianState: 'ok',
            guardianNote: `Guardian key works: ${ok} of ${all.length} topics, ${articles.toLocaleString()} articles in the last 45 days.${err ? ` Some failed: ${err}.` : ''}`,
          }
        : {
            guardianState: 'error',
            guardianNote: err ? `Guardian: ${err}.` : 'Guardian returned no articles for these topics.',
          },
    );
  }
  /** Clears every series and starts over: a first load now, then one on a timer. */
  function start(): void {
    state.liveLoaded = false;
    deps.entries().forEach(E => {
      E.parts = {};
      E.partErr = {};
      E.liveSeries = [];
      E.liveError = null;
      E.stats = null;
    });
    state.alerts = [];
    beat('connecting…');
    void load();
    clearInterval(timer);
    timer = setInterval(load, deps.every ?? LIVE_REFRESH_MS);
  }
  /** Cancels any load in flight and the timer. */
  function stop(): void {
    abort?.abort();
    abort = null;
    clearInterval(timer);
    timer = undefined;
  }
  return {
    parts,
    recompute,
    fetchPart,
    load,
    start,
    stop,
    setStatus,
    /** Fetch again now, keeping what's on screen until new data arrives (ignored while a load runs). */
    refresh: (): void => void (ui.loading || load()),
    /** When the last load finished (ms), or 0. */
    updated: (): number => updated,
    /** The running load's signal, if one is running, so a one-off fetch can be cancelled with it. */
    signal: (): AbortSignal | undefined => (abort && !abort.signal.aborted ? abort.signal : undefined),
  };
}
export type LiveLoop = ReturnType<typeof createLiveLoop>;

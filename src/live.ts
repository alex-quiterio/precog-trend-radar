// PRECOG / Trend Radar · The data loop: fetches every topic from every trend source, keeps what's on screen
// until new data arrives, refreshes on a timer, and reports progress and failures in the status line.
// The channel on screen comes first, at full speed: once its topics are in, the screen counts as loaded. The
// other channels follow in the background, one request per source at a time with a pause between, so a cold
// start doesn't flood Wikipedia. Switching channel mid-load moves that channel's topics to the front.
// createLiveLoop takes everything it touches as arguments, so it can be tested with fake sources;
// the app makes one (context.ts).
import { markRaw } from 'vue';
import { HISTORY, LIVE_REFRESH_MS } from '@core/config';
import { errorText, isAbort } from '@core/errors';
import { hhmm } from '@core/format';
import { computeStats } from '@core/stats';
import { blendParts } from '@sources/blend';
import { queryOf } from '@sources/registry';
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
  /** True for a topic of the channel on screen (fetched first). Left out, every topic counts as on screen. */
  onScreen?(E: Entry): boolean;
  /** Called when the channel on screen has all its topics (the app rescans its alerts straight away). */
  onScreenReady?(): void;
  /** The pause between background requests to one source, in ms. */
  backgroundGapMs?: number;
  /** How often to refresh, in ms. */
  every?: number;
}

export function createLiveLoop(deps: LoopDeps) {
  const { adapters, sources, state, ui } = deps;
  let timer: ReturnType<typeof setInterval> | undefined,
    abort: AbortController | null = null,
    updated = 0;
  const onScreen = (E: Entry): boolean => deps.onScreen?.(E) ?? true;
  const gap = deps.backgroundGapMs ?? 300;
  /** The running load: what's left per source, and how far the channel on screen has got. */
  let run: {
    signal: AbortSignal;
    entries: Entry[];
    queues: Map<string, Entry[]>;
    inFlight: number;
    done: number;
    ready: boolean;
  } | null = null;

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
  /** Topics of the channel on screen still to fetch or being fetched, in the running load. */
  const screenLeft = (): number => {
    if (!run) return 0;
    let n = run.inFlight;
    run.queues.forEach(q => (n += q.filter(onScreen).length));
    return n;
  };
  const screenEntries = (all: Entry[]): Entry[] => all.filter(onScreen);
  function progress(): void {
    if (!run || run.ready || run.signal.aborted) return;
    setStatus(`Fetching attention data… ${run.done}/${run.done + screenLeft()}`);
  }
  /** Once the channel on screen has everything: the screen counts as loaded, while the rest carry on. */
  function checkScreen(): void {
    if (!run || run.ready || run.signal.aborted || screenLeft() > 0) return;
    run.ready = true;
    ui.loading = false;
    updated = Date.now();
    state.liveLoaded = true;
    beat(`updated ${hhmm(updated)}`);
    const behind = [...run.queues.values()].some(q => q.length);
    report(screenEntries(run.entries), parts(), behind);
    deps.onScreenReady?.();
  }
  /** One source's worker: the channel on screen first; then the rest, one at a time with a pause between. */
  async function worker(pid: string, mine: NonNullable<typeof run>, busy: Set<string>): Promise<void> {
    const { signal } = mine,
      q = mine.queues.get(pid) as Entry[];
    while (!signal.aborted) {
      let i = q.findIndex(onScreen);
      const background = i < 0;
      if (background) {
        if (!q.length) return;
        if (busy.has(pid)) {
          await new Promise(r => setTimeout(r, gap));
          continue;
        }
        i = 0;
        busy.add(pid);
      }
      const E = q.splice(i, 1)[0];
      if (!background) mine.inFlight++;
      await fetchPart(E, pid, signal);
      if (signal.aborted) return;
      if (!background) {
        mine.inFlight--;
        mine.done++;
        progress();
        checkScreen();
      } else {
        await new Promise(r => setTimeout(r, gap));
        busy.delete(pid);
      }
    }
  }
  /** Fetches everything. A newer load cancels an older one still running. */
  async function load(): Promise<void> {
    const ps = parts();
    if (!ps.length) return;
    abort?.abort();
    abort = new AbortController();
    const { signal } = abort;
    const entries = deps.entries();
    const mine = (run = {
      signal,
      entries,
      queues: new Map(ps.map(pid => [pid, [...entries]])),
      inFlight: 0,
      done: 0,
      ready: false,
    });
    ui.loading = true;
    if (ui.guardian) Object.assign(ui, { guardianState: 'checking', guardianNote: 'Counting Guardian articles…' });
    progress();
    deps.onLoadStart?.();
    const busy = new Set<string>();
    await Promise.all(
      ps.flatMap(pid => Array.from({ length: adapters[pid].concurrency || 4 }, () => worker(pid, mine, busy))),
    );
    if (signal.aborted) return;
    checkScreen(); // a load with nothing on screen
    abort = null; // finished: nothing is running now
    run = null;
    ui.loading = false;
    state.liveLoaded = true;
    deps.onLoaded?.();
    reportGuardian(entries);
    report(screenEntries(entries), ps);
  }
  /**
   * The channel on screen changed. If the running load hasn't fetched its topics yet, they go first now, and
   * the screen shows as loading until they're in.
   */
  function focus(): void {
    if (!run || run.signal.aborted || !screenLeft()) return;
    run.ready = false;
    run.done = 0;
    ui.loading = true;
    state.liveLoaded = false;
    progress();
  }
  /** The status line after a load: all good, partly missing, or nothing reachable. `behind`: others still loading. */
  function report(all: Entry[], ps: string[], behind = false): void {
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
        (behind ? ' Other channels are catching up.' : '') +
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
    run = null;
    ui.loading = false; // the cancelled load returns without clearing it
    clearInterval(timer);
    timer = undefined;
  }
  return {
    parts,
    recompute,
    fetchPart,
    load,
    focus,
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

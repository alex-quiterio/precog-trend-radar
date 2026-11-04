// PRECOG / Trend Radar · GDELT global news share per day, throttled to its one-request-per-5-s limit.
//
// Reads, in order: today's localStorage cache → the daily snapshot that CI publishes next to the page
// (data/gdelt.json, built by scripts/gdelt-snapshot.ts) → GDELT itself, one request at a time.
import { HOUR, MIN, sleep, store } from '../core/config';
import { gdeltDate, gdeltQuery, storyQueries, timelinePoints } from './gdelt-query';
import { registerAdapter, utcDay, withTimeout } from './registry';

const PAUSE_KEY = 'precog.gdelt.pause';
const BASE_GAP = 6000;

// --- GDELT global news (strict rate limit: one call per ~5 s) ----------
export const gdelt = {
  last: 0,
  chain: Promise.resolve(),
  strikes: 0,
  pausedUntil: store.get(PAUSE_KEY, 0) as number,
};
/** GDELT's 429 replies carry no CORS header, so a browser sees them as a network error, not a status. */
function strike(): void {
  gdelt.strikes++;
  if (gdelt.strikes >= 3) {
    gdelt.pausedUntil = Date.now() + 20 * MIN;
    store.set(PAUSE_KEY, gdelt.pausedUntil); // survive reloads, so a refresh doesn't restart the penalty
  }
}
export function gdeltCall(params: string, signal?: AbortSignal): Promise<any> {
  const run = gdelt.chain.then(async () => {
    if (Date.now() < gdelt.pausedUntil)
      throw new Error(
        `GDELT is rate-limiting this network; paused until ${new Date(gdelt.pausedUntil).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`,
      );
    // Back off exponentially after each refusal: 6 s, 12 s, 24 s.
    const wait = gdelt.last + BASE_GAP * 2 ** gdelt.strikes - Date.now();
    if (wait > 0) await sleep(wait);
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    gdelt.last = Date.now();
    let r: Response;
    try {
      r = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?format=json&${params}`, {
        signal: withTimeout(signal, 45000),
      });
    } catch (e) {
      if (signal?.aborted) throw e;
      strike();
      throw new Error('GDELT refused the request (rate limit or timeout)');
    } finally {
      gdelt.last = Date.now(); // GDELT counts from the end of a slow reply, not the start
    }
    const text = await r.text();
    if (!r.ok || /^\s*Please limit/i.test(text)) {
      strike();
      throw new Error('GDELT rate limit');
    }
    gdelt.strikes = 0;
    try {
      return JSON.parse(text || '{}');
    } catch {
      throw new Error(text.slice(0, 80) || 'GDELT returned no JSON');
    }
  });
  gdelt.chain = run.then(
    () => {},
    () => {},
  );
  return run;
}
export { gdeltDate, gdeltQuery, storyQueries, timelinePoints };

// --- Snapshot published by CI (same origin; absent when opened from file://) -----
export interface GdeltArticle {
  url: string;
  title: string;
  domain: string;
  sourcecountry?: string;
  seendate?: string;
}
export interface GdeltSnapshot {
  at: string;
  timelines: Record<string, { t: string; value: number }[]>;
  articles?: Record<string, GdeltArticle[]>;
}
let snapshot: Promise<GdeltSnapshot | null> | null = null;
let snapshotAt = 0;
export function loadSnapshot(): Promise<GdeltSnapshot | null> {
  if (snapshot && Date.now() - snapshotAt < HOUR) return snapshot;
  snapshotAt = Date.now();
  snapshot =
    typeof location === 'undefined' || location.protocol === 'file:'
      ? Promise.resolve(null)
      : fetch('./data/gdelt.json', { cache: 'no-cache', signal: AbortSignal.timeout(15000) })
          .then(r => (r.ok ? r.json() : null))
          .then(j => (j && j.timelines ? j : null))
          .catch(() => null);
  return snapshot;
}

registerAdapter({
  id: 'news',
  label: 'Global news share (GDELT) / day',
  unit: '% of coverage',
  concurrency: 1,
  weight: 0.45,
  minMean: 0,
  async fetch(topic, { signal, query }) {
    const q = gdeltQuery(query.q || topic, query.country);
    const key = 'precog.gdelt.v1.' + q.toLowerCase();
    const c = store.get(key, null);
    if (c && c.day === utcDay() && c.points.length) return { topic, points: c.points };
    const snap = await loadSnapshot();
    const fromSnap = snap?.timelines[q.toLowerCase()];
    // A snapshot from yesterday is still better than hammering GDELT; it's at most a day behind.
    if (fromSnap?.length && Date.now() - Date.parse(snap.at) < 36 * HOUR) {
      store.set(key, { day: utcDay(), points: fromSnap });
      return { topic, points: fromSnap };
    }
    const points = timelinePoints(
      await gdeltCall(`mode=timelinevol&timespan=3months&query=${encodeURIComponent(q)}`, signal),
    );
    if (!points.length) throw new Error('no news coverage found');
    store.set(key, { day: utcDay(), points });
    return { topic, points };
  },
});

// PRECOG / Trend Radar · GitHub new repositories per week, throttled for the unauthenticated search limit.
import { DAY, HOUR, sleep, store } from '../core/config';
import { getJSON, iso, registerAdapter, utcDay } from './registry';

// --- GitHub (weekly new repos; ~10 unauthenticated searches/min) ---------
export const ghQueue = { last: 0, chain: Promise.resolve() };
export function ghThrottled(url, signal) {
  const run = ghQueue.chain.then(async () => {
    const wait = ghQueue.last + 6500 - Date.now();
    if (wait > 0) await sleep(wait);
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    ghQueue.last = Date.now();
    return getJSON(url, signal);
  });
  ghQueue.chain = run.catch(() => {});
  return run;
}
registerAdapter({
  id: 'github',
  label: 'GitHub new repos / week',
  unit: 'repos',
  concurrency: 1,
  async fetch(topic, { signal, query }) {
    const weeks = 12,
      end = utcDay(),
      d = t => new Date(t).toISOString().slice(0, 10),
      points = [];
    for (let w = weeks; w >= 1; w--) {
      const a = end - w * 7 * DAY,
        b = a + 6 * DAY;
      const key = `precog.gh.${(query.q || topic).toLowerCase()}.${d(a)}`;
      let cached = store.get(key, null);
      if (!cached || Date.now() - cached.at > 12 * HOUR) {
        try {
          const j = await ghThrottled(
            `https://api.github.com/search/repositories?per_page=1&q=${encodeURIComponent(`${query.q || topic} created:${d(a)}..${d(b)}`)}`,
            signal,
          );
          cached = { at: Date.now(), v: j.total_count || 0 };
          store.set(key, cached);
        } catch (e) {
          if (e.status === 403 || e.status === 429) throw new Error('GitHub rate limit hit; try again in a minute');
          throw e;
        }
      }
      points.push({ t: iso(a), value: cached.v });
    }
    return { topic, points };
  },
});

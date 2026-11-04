// PRECOG / Trend Radar · GDELT global news share per day, throttled to its one-request-per-5-s limit.
import { MIN, sleep, store } from '../core/config';
import { mean } from '../core/stats';
import { iso, phrase, registerAdapter, utcDay } from './registry';

// --- GDELT global news (strict rate limit: one call per ~5 s) ----------
export const gdelt = { last: 0, chain: Promise.resolve(), strikes: 0, pausedUntil: 0 };
export function gdeltCall(params, signal) {
  const run = gdelt.chain.then(async () => {
    if (Date.now() < gdelt.pausedUntil) throw new Error('GDELT is rate-limiting this browser; paused for a while');
    const wait = gdelt.last + 6000 - Date.now();
    if (wait > 0) await sleep(wait);
    if (signal && signal.aborted) throw new DOMException('aborted', 'AbortError');
    gdelt.last = Date.now();
    const r = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?format=json&${params}`, { signal });
    const text = await r.text();
    if (!r.ok || /^\s*Please limit/i.test(text)) {
      if (++gdelt.strikes >= 3) gdelt.pausedUntil = Date.now() + 20 * MIN;
      throw new Error('GDELT rate limit');
    }
    gdelt.strikes = 0;
    try {
      return JSON.parse(text || '{}');
    } catch {
      throw new Error(text.slice(0, 80) || 'GDELT returned no JSON');
    }
  });
  gdelt.chain = run.catch(() => {});
  return run;
}
export const gdeltDate = s =>
  Date.parse(
    `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11) || '00'}:${s.slice(11, 13) || '00'}:${s.slice(13, 15) || '00'}Z`,
  );
registerAdapter({
  id: 'news',
  label: 'Global news share (GDELT) / day',
  unit: '% of coverage',
  concurrency: 1,
  weight: 0.45,
  minMean: 0,
  async fetch(topic, { signal, query }) {
    const q = phrase(query.q || topic) + (query.country ? ` sourcecountry:${query.country}` : '');
    const key = 'precog.gdelt.v1.' + q.toLowerCase();
    const c = store.get(key, null);
    if (c && c.day === utcDay() && c.points.length) return { topic, points: c.points };
    const j = await gdeltCall(`mode=timelinevol&timespan=3months&query=${encodeURIComponent(q)}`, signal);
    const byDay = new Map();
    (j.timeline?.[0]?.data || []).forEach(d => {
      const t = utcDay(gdeltDate(d.date));
      const o = byDay.get(t) || [];
      o.push(+d.value);
      byDay.set(t, o);
    });
    const points = [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([t, vs]) => ({ t: iso(t), value: mean(vs) }));
    if (!points.length) throw new Error('no news coverage found');
    store.set(key, { day: utcDay(), points });
    return { topic, points };
  },
});

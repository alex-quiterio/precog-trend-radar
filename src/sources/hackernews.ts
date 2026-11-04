// PRECOG / Trend Radar · Hacker News stories per day (Algolia), cached per day.
import { DAY, store } from '../core/config';
import { SKIP, getJSON, iso, phrase, pool, registerAdapter, utcDay } from './registry';

// --- Hacker News (per-day counts, cached per day) ----------------------
registerAdapter({
  id: 'hn',
  label: 'Hacker News stories / day',
  unit: 'stories',
  concurrency: 4,
  weight: 0.2,
  minMean: 1,
  async fetch(topic, { signal, query }) {
    if (query.lang && query.lang !== 'en') return SKIP(topic, 'Hacker News is English-only');
    const q = phrase(query.q || topic),
      days = 45,
      end = utcDay();
    const key = 'precog.hn.v2.' + q.toLowerCase();
    const cache = store.get(key, { days: {} });
    const starts = Array.from({ length: days }, (_, i) => end - (days - i) * DAY);
    let need = starts.filter(s => cache.days[s] == null || s >= end - 2 * DAY);
    if (need.length > 3) {
      const a = need[0],
        b = need[need.length - 1] + DAY;
      const nfil = encodeURIComponent(`created_at_i>=${a / 1000},created_at_i<${b / 1000}`);
      const j = await getJSON(
        `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&typoTolerance=false&tags=story&hitsPerPage=1000&attributesToRetrieve=created_at_i&numericFilters=${nfil}`,
        signal,
      );
      if ((j.hits || []).length >= (j.nbHits || 0)) {
        // complete: bucket locally, one request
        need.forEach(s => {
          cache.days[s] = 0;
        });
        j.hits.forEach(x => {
          const s = utcDay(x.created_at_i * 1000);
          if (s in cache.days || need.includes(s)) cache.days[s] = (cache.days[s] || 0) + 1;
        });
        need = [];
      }
    }
    await pool(need, 6, async s => {
      const nfil = encodeURIComponent(`created_at_i>=${s / 1000},created_at_i<${(s + DAY) / 1000}`);
      const j = await getJSON(
        `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&typoTolerance=false&tags=story&hitsPerPage=0&numericFilters=${nfil}`,
        signal,
      );
      cache.days[s] = j.nbHits || 0;
    });
    Object.keys(cache.days).forEach(k => {
      if (+k < end - 70 * DAY) delete cache.days[k];
    });
    store.set(key, cache);
    return { topic, points: starts.map(s => ({ t: iso(s), value: cache.days[s] || 0 })) };
  },
});

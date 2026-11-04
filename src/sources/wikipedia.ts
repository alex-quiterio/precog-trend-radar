// PRECOG / Trend Radar · Wikipedia pageviews per day, in the lens language (en/pt/nl).
import { DAY, LS, store } from '../core/config';
import { looksLikePerson } from '../core/guard';
import { getJSON, registerAdapter, utcDay } from './registry';

// --- Wikipedia -------------------------------------------------------
export async function resolveWikiTitle(q, signal, lang = 'en') {
  const cache = store.get(LS.wikiTitles, {}),
    ck = `${lang}:${q}`;
  if (cache[ck]) return cache[ck];
  const api = `https://${lang}.wikipedia.org/w/api.php?format=json&origin=*&`;
  const j = await getJSON(api + `action=query&redirects=1&titles=${encodeURIComponent(q)}`, signal);
  const page = Object.values(
    (j.query?.pages || {}) as Record<string, { title: string; missing?: string; invalid?: string }>,
  )[0];
  let title = page && !('missing' in page) && !('invalid' in page) ? page.title : null;
  if (!title) {
    const o = await getJSON(api + `action=opensearch&namespace=0&limit=1&search=${encodeURIComponent(q)}`, signal);
    title = o[1]?.[0] || null;
  }
  if (!title) throw new Error('no matching Wikipedia article');
  if (looksLikePerson(title)) throw new Error('the closest Wikipedia article is about a person, so it is skipped');
  cache[ck] = title;
  store.set(LS.wikiTitles, cache);
  return title;
}
registerAdapter({
  id: 'wikipedia',
  label: 'Wikipedia pageviews / day',
  unit: 'views',
  concurrency: 4,
  weight: 0.35,
  minMean: 20,
  async fetch(topic, { signal, query }) {
    const lang = query.lang || 'en';
    const title = await resolveWikiTitle(query.wiki || topic, signal, lang);
    const ymd = t => new Date(t).toISOString().slice(0, 10).replace(/-/g, '');
    const end = utcDay() - DAY,
      start = end - 59 * DAY;
    const j = await getJSON(
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia/all-access/user/${encodeURIComponent(title.replace(/ /g, '_'))}/daily/${ymd(start)}/${ymd(end)}`,
      signal,
    );
    return {
      topic,
      meta: { wikiTitle: title, wikiLang: lang },
      points: (j.items || []).map(it => ({
        t: `${it.timestamp.slice(0, 4)}-${it.timestamp.slice(4, 6)}-${it.timestamp.slice(6, 8)}T00:00:00Z`,
        value: it.views,
      })),
    };
  },
});

// PRECOG / Trend Radar · The Guardian: articles per day naming the topic, and the newest ones to read.
// Needs a free developer key from https://open-platform.theguardian.com/access/ (about 500 calls a day,
// one a second). The key lives only in this browser's storage, never in the page source.
import { DAY, sleep, store } from '../core/config';
import { HttpError, SKIP, getJSON, iso, phrase, registerAdapter, utcDay } from './registry';

const KEY = 'precog.guardian.key';
export const guardianKey = (): string => String(store.get(KEY, '') || '').trim();
export function setGuardianKey(k: string): void {
  store.set(KEY, String(k || '').trim());
}

const queue = { last: 0, chain: Promise.resolve() as Promise<unknown> };
function throttled(url: string, signal: AbortSignal): Promise<any> {
  const run = queue.chain.then(async () => {
    const wait = queue.last + 1100 - Date.now();
    if (wait > 0) await sleep(wait);
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    queue.last = Date.now();
    return getJSON(url, signal);
  });
  queue.chain = run.catch(() => {});
  return run;
}

/** A Guardian article naming a topic, kept from the same requests that count coverage. */
export interface GuardianArticle {
  id: string;
  title: string;
  url: string;
  section: string;
  t: number;
}
const cacheKey = (q: string) => 'precog.guardian.v2.' + phrase(q).toLowerCase();
/** The newest articles for a topic phrase, from today's cache (filled by the trend fetch). */
export function guardianArticles(q: string): GuardianArticle[] {
  const c = store.get<{ day: number; articles?: GuardianArticle[] } | null>(cacheKey(q), null);
  return c && c.day === utcDay() ? c.articles || [] : [];
}

registerAdapter({
  id: 'guardian',
  label: 'The Guardian articles / day',
  unit: 'articles',
  concurrency: 1,
  weight: 0.45,
  minMean: 1,
  async fetch(topic, { signal, query }) {
    if (query.lang && query.lang !== 'en') return SKIP(topic, 'The Guardian is English-only');
    const key = guardianKey();
    if (!key) return SKIP(topic, 'add a Guardian API key to include news');
    const q = phrase(query.q || topic);
    const ck = cacheKey(query.q || topic);
    const c = store.get<{ day: number; points: { t: string; value: number }[] } | null>(ck, null);
    if (c && c.day === utcDay()) return { topic, points: c.points };
    const articles: GuardianArticle[] = [];

    const days = 45,
      end = utcDay() + DAY,
      from = new Date(end - days * DAY).toISOString().slice(0, 10);
    const counts = new Array(days).fill(0);
    // Up to 1,000 articles (5 pages of 200); a topic busier than that is busy enough.
    for (let page = 1, pages = 1; page <= pages && page <= 5; page++) {
      let j;
      try {
        j = await throttled(
          `https://content.guardianapis.com/search?q=${encodeURIComponent(q)}&from-date=${from}&order-by=newest&page-size=200&page=${page}&show-fields=none&api-key=${encodeURIComponent(key)}`,
          signal,
        );
      } catch (e) {
        if (e instanceof HttpError && (e.status === 401 || e.status === 403))
          throw new Error('The Guardian rejected the API key');
        if (e instanceof HttpError && e.status === 429) throw new Error('Guardian daily limit reached');
        // A rejected key comes back without CORS headers, so the browser only sees a network error.
        if (e instanceof TypeError) throw new Error('The Guardian refused the request (most likely the key)');
        throw e;
      }
      pages = j.response?.pages || 1;
      (j.response?.results || []).forEach(a => {
        const t = Date.parse(a.webPublicationDate);
        const k = Math.floor((t - (end - days * DAY)) / DAY);
        if (k >= 0 && k < days) counts[k]++;
        // Results come newest first: keep the first 20 to list in the News stream.
        if (articles.length < 20 && a.type === 'article')
          articles.push({ id: a.id, title: a.webTitle, url: a.webUrl, section: a.sectionName || '', t });
      });
    }
    const points = counts.map((value, k) => ({ t: iso(end - (days - k) * DAY), value }));
    store.set(ck, { day: utcDay(), points, articles });
    return { topic, points };
  },
});

// PRECOG / Trend Radar · Streams: the news (The Guardian), what you're reading (followed sites), what
// forecasters expect (Manifold) and what's spreading among builders (Hacker News), matched to your topics.
import { reactive } from 'vue';
import type { Entry } from '../types';
import { HOUR, LS, MIN, STORY_REFRESH_MS, store } from '../core/config';
import type { Forecast } from '../sources/manifold';
import { searchForecasts } from '../sources/manifold';
import type { ReadingItem } from '../sources/reading';
import { loadReading, readingScore } from '../sources/reading';
import type { GuardianArticle } from '../sources/guardian';
import { guardianArticles, guardianKey } from '../sources/guardian';
import { ADAPTERS, getJSON, phrase, pool, queryOf, topicRegex } from '../sources/registry';
import { activeChannel } from '../channels';
import { activeLens, entriesOf, selectedEntry, state } from '../state';

/** A Hacker News story with its measured or estimated engagement velocity. */
export interface HNStory {
  id: string;
  title: string;
  url: string;
  discuss: string;
  domain: string;
  t: number;
  points: number;
  comments: number;
  topics: string[];
  eng?: number;
  vel?: number;
  pred24?: number;
  age?: number;
  measured?: boolean;
}
/** A post from a followed site, with the topics in scope it names. */
export interface ReadingMatch extends ReadingItem {
  topics: string[];
  score: number;
}
/** A Guardian article naming topics in scope. */
export interface NewsMatch extends GuardianArticle {
  topics: string[];
}
/** An open prediction market on a topic in scope. */
export interface ForecastMatch extends Forecast {
  topics: string[];
}
export type StorySrc = 'news' | 'reading' | 'forecasts' | 'hn';
export const stories = reactive({
  hn: new Map<string, HNStory>(),
  forecasts: new Map<string, ForecastMatch>(),
  news: new Map<string, NewsMatch>(),
  reading: new Map<string, ReadingMatch>(),
  readingCount: 0,
  loading: { hn: false, forecasts: false, reading: false, news: false },
  errors: { hn: null, forecasts: null, reading: null, news: null },
  at: { hn: 0, forecasts: 0, reading: 0, news: 0 },
});
export let storyTimer = null,
  storyAbort = null;
export const TAU = 8; // hours; engagement modelled as E(t) = E∞·(1 − e^(−t/τ))
/** Streams look at the selected topic, or at every topic of the channel on screen. */
export function storyScopeEntries(): Entry[] {
  if (state.storyScope === 'topic') return [selectedEntry()].filter(Boolean);
  return entriesOf(activeLens());
}
export function observe(id, eng) {
  const obs = store.get(LS.storyObs, {});
  const now = Date.now(),
    o = obs[id];
  let rate = null;
  if (o && o.prev && o.cur.t - o.prev.t >= 5 * MIN) rate = (o.cur.eng - o.prev.eng) / ((o.cur.t - o.prev.t) / HOUR);
  if (!o) obs[id] = { cur: { t: now, eng } };
  else if (now - o.cur.t >= 5 * MIN) {
    obs[id] = { prev: o.cur, cur: { t: now, eng } };
    rate = (eng - o.cur.eng) / ((now - o.cur.t) / HOUR);
  }
  Object.keys(obs).forEach(k => {
    if (now - obs[k].cur.t > 72 * HOUR) delete obs[k];
  });
  store.set(LS.storyObs, obs);
  return rate;
}
export async function loadHNStories(entries: Entry[], signal: AbortSignal): Promise<void> {
  const since = Math.floor((Date.now() - 48 * HOUR) / 1000);
  const found = new Map();
  await pool(
    entries.filter(E => queryOf(E).lang === 'en'),
    4,
    async E => {
      const q = phrase(queryOf(E).q);
      const j = await getJSON(
        `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&typoTolerance=false&tags=story&hitsPerPage=20&numericFilters=${encodeURIComponent('created_at_i>' + since)}&attributesToRetrieve=title,url,points,num_comments,created_at_i`,
        signal,
      );
      const re = topicRegex(queryOf(E).q);
      (j.hits || [])
        .filter(h => re.test(h.title || ''))
        .forEach(h => {
          const s = found.get(h.objectID) || {
            id: 'hn:' + h.objectID,
            title: h.title,
            url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
            discuss: `https://news.ycombinator.com/item?id=${h.objectID}`,
            domain: h.url ? new URL(h.url).hostname.replace(/^www\./, '') : 'news.ycombinator.com',
            t: h.created_at_i * 1000,
            points: h.points || 0,
            comments: h.num_comments || 0,
            topics: [],
          };
          if (!s.topics.includes(E.key)) s.topics.push(E.key);
          found.set(h.objectID, s);
        });
      stories.hn = new Map([...stories.hn, ...found]);
    },
  );
  const now = Date.now();
  found.forEach(s => {
    const age = Math.max(0.5, (now - s.t) / HOUR);
    s.eng = s.points + s.comments;
    const measured = observe(s.id, s.eng);
    s.measured = measured != null;
    s.vel = s.measured ? Math.max(0, measured) : s.eng / age;
    const einf = s.eng / (1 - Math.exp(-age / TAU));
    s.pred24 = age >= 24 ? s.eng : einf * (1 - Math.exp(-24 / TAU));
    s.age = age;
  });
  stories.hn = found;
}
/** Every followed site's posts, credited to the topics in scope they name (by name, phrase or article title). */
export async function loadReadingStories(entries: Entry[], signal: AbortSignal): Promise<void> {
  const { items: all, errors } = await loadReading(signal);
  const sites = activeChannel().sites;
  const items = sites?.length ? all.filter(it => sites.includes(it.origin)) : all;
  const matchers = entries.map(E => {
    const qq = queryOf(E);
    const terms = [...new Set([qq.q, E.name, qq.wiki].filter(Boolean).map(t => t.replace(/"/g, '').trim()))];
    return { key: E.key, res: terms.filter(t => t.length >= 2).map(topicRegex) };
  });
  const found = new Map<string, ReadingMatch>();
  items.forEach(it => {
    let score = 0;
    const topics: string[] = [];
    matchers.forEach(m => {
      const s = readingScore(it, m.res);
      if (s) {
        score += s;
        topics.push(m.key);
      }
    });
    found.set(it.id, { ...it, topics, score });
  });
  stories.reading = found;
  stories.readingCount = items.length;
  stories.errors.reading = errors.length ? errors.join('; ') : null;
}
/** Open markets whose question names a topic in scope (Manifold's search is fuzzy, so we re-check). */
export async function loadForecastStories(entries: Entry[], signal: AbortSignal): Promise<void> {
  const found = new Map<string, ForecastMatch>();
  await pool(entries, 4, async E => {
    const qq = queryOf(E);
    const res = [...new Set([qq.q, E.name].map(t => t.replace(/"/g, '').trim()))].map(topicRegex);
    const list = await searchForecasts(qq.q.replace(/"/g, ''), signal);
    list
      .filter(f => res.some(re => re.test(f.question)))
      .forEach(f => {
        const m = found.get(f.id) || { ...f, topics: [] };
        if (!m.topics.includes(E.key)) m.topics.push(E.key);
        found.set(f.id, m);
      });
    stories.forecasts = new Map(found);
  });
  stories.forecasts = found;
}
/**
 * Guardian articles for the topics in scope. Reuses what the trend fetch cached today; a topic not
 * fetched yet is fetched now (same request, same cache), so the stream never costs extra calls.
 */
export async function loadNewsStories(entries: Entry[], signal: AbortSignal): Promise<void> {
  if (!guardianKey()) throw new Error('add a Guardian API key (top bar) to see Guardian articles');
  const found = new Map<string, NewsMatch>();
  for (const E of entries) {
    if (signal.aborted) return;
    const q = queryOf(E);
    if (!guardianArticles(q.q).length) await ADAPTERS.guardian.fetch(E.name, { signal, query: q });
    guardianArticles(q.q).forEach(a => {
      const m = found.get(a.id) || { ...a, topics: [] };
      if (!m.topics.includes(E.key)) m.topics.push(E.key);
      found.set(a.id, m);
    });
    stories.news = new Map(found);
  }
}
export async function loadStories() {
  if (storyAbort) storyAbort.abort();
  storyAbort = new AbortController();
  const streams = activeChannel().streams.filter(s => s !== 'news' || guardianKey());
  if (!streams.includes(state.storySrc)) state.storySrc = streams[0] || 'reading';
  const { signal } = storyAbort,
    src = state.storySrc,
    entries = storyScopeEntries();
  stories.loading[src] = true;
  try {
    if (src === 'hn') await loadHNStories(entries, signal);
    else if (src === 'forecasts') await loadForecastStories(entries, signal);
    else if (src === 'news') await loadNewsStories(entries, signal);
    else await loadReadingStories(entries, signal);
    if (src !== 'reading') stories.errors[src] = null;
    stories.at[src] = Date.now();
  } catch (e) {
    if (e.name !== 'AbortError') stories.errors[src] = e.message;
  }
  stories.loading[src] = false;
}
export function startStoryTimer(): void {
  clearInterval(storyTimer);
  storyTimer = setInterval(() => {
    if (document.visibilityState === 'visible') loadStories();
  }, STORY_REFRESH_MS);
}

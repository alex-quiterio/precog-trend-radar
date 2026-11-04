// PRECOG / Trend Radar · Rising stories: HN engagement velocity, GDELT and local-feed story clusters.
import type { Entry } from '../types';
import { HOUR, LS, MIN, STORY_REFRESH_MS, store } from '../core/config';
import { bump } from '../core/ui-store';
import { orderedEntries } from '../live';
import type { GdeltArticle } from '../sources/gdelt';
import { gdelt, gdeltCall, gdeltDate, loadSnapshot, storyQueries } from '../sources/gdelt';
import { getJSON, phrase, pool, queryOf } from '../sources/registry';
import { loadFeedItems, rssCache, topicRegex } from '../sources/rss';
import type { TGSItem } from '../sources/tgs';
import { loadTGSCatalog, tgsScore } from '../sources/tgs';
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
/** Articles about one story, grouped across outlets. */
export interface StoryCluster {
  id: string;
  title: string;
  url: string;
  domain?: string;
  tk: Set<string>;
  domains: Set<string>;
  countries: Set<string>;
  first: number;
  topics: string[];
}
/** A Great Simplification episode or Frankly that mentions some of the topics in scope. */
export interface TGSMatch extends TGSItem {
  topics: string[];
  score: number;
}
export const stories = {
  hn: new Map<string, HNStory>(),
  news: new Map<string, StoryCluster>(),
  local: new Map<string, StoryCluster>(),
  tgs: new Map<string, TGSMatch>(),
  tgsCount: 0,
  loading: { hn: false, news: false, local: false, tgs: false },
  errors: { hn: null, news: null, local: null, tgs: null },
  at: { hn: 0, news: 0, local: 0, tgs: 0 },
};
export let storyTimer = null,
  storyAbort = null;
export const TAU = 8; // hours; engagement modelled as E(t) = E∞·(1 − e^(−t/τ))
export function storyScopeEntries(): Entry[] {
  if (state.storyScope === 'topic') return [selectedEntry()].filter(Boolean);
  if (state.storyScope === 'lens') return entriesOf(activeLens());
  return orderedEntries();
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
      if (!signal.aborted) bump();
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
export const STOP = new Set(
  'the a an and or of to in on for with at by from as is are was were be been it its this that after over into new says say amid about against more than will has have not but who what why how'.split(
    ' ',
  ),
);
export const toks = t =>
  new Set(
    String(t)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP.has(w)),
  );
export function jaccard(a, b) {
  let i = 0;
  a.forEach(x => {
    if (b.has(x)) i++;
  });
  return i / (a.size + b.size - i || 1);
}
const ARTICLE_KEY = 'precog.gdelt.articles.v1.';
/** Articles from the last 24 h for one combined query: CI snapshot if fresh, then today's cache, then GDELT. */
async function newsArticles(q: string, signal: AbortSignal): Promise<GdeltArticle[]> {
  const snap = await loadSnapshot();
  const fromSnap = snap?.articles?.[q.toLowerCase()];
  if (fromSnap && Date.now() - Date.parse(snap.at) < 8 * HOUR) return fromSnap;
  const c = store.get<{ at: number; articles: GdeltArticle[] } | null>(ARTICLE_KEY + q.toLowerCase(), null);
  if (c && Date.now() - c.at < HOUR) return c.articles;
  const j = await gdeltCall(
    `mode=artlist&timespan=24h&maxrecords=250&sort=hybridrel&query=${encodeURIComponent(q)}`,
    signal,
  );
  const articles: GdeltArticle[] = (j.articles || []).map(a => ({
    url: a.url,
    title: a.title,
    domain: a.domain,
    sourcecountry: a.sourcecountry,
    seendate: a.seendate,
  }));
  store.set(ARTICLE_KEY + q.toLowerCase(), { at: Date.now(), articles });
  return articles;
}
export async function loadNewsStories(entries: Entry[], signal: AbortSignal): Promise<void> {
  const clusters = [];
  const byKey = new Map(entries.map(E => [E.key, E]));
  // Grouped per lens, like the CI snapshot, so its combined queries can be reused here.
  const lensIds = [...new Set(entries.map(E => E.lensId))];
  const groups = lensIds.flatMap(id =>
    storyQueries(
      entries
        .filter(E => E.lensId === id)
        .map(E => {
          const qq = queryOf(E);
          return { key: E.key, q: qq.q, country: qq.country };
        }),
    ),
  );
  if (!groups.length) throw new Error('topic names are too short for GDELT (3+ letters)');
  for (const g of groups) {
    if (signal.aborted) return;
    try {
      const articles = await newsArticles(g.q, signal);
      // One request covers several topics, so each headline is credited to the topics it names.
      const matchers = g.keys.map(k => [k, topicRegex(queryOf(byKey.get(k)).q)] as const);
      articles.forEach(a => {
        const tk = toks(a.title);
        if (tk.size < 3) return;
        const hit = matchers.filter(([, re]) => re.test(a.title)).map(([k]) => k);
        const keys = hit.length ? hit : g.keys.length === 1 ? g.keys : [];
        if (!keys.length) return;
        let c = clusters.find(c => jaccard(c.tk, tk) >= 0.34);
        if (!c) {
          c = {
            id: 'news:' + a.url,
            title: a.title,
            url: a.url,
            tk,
            domains: new Set(),
            countries: new Set(),
            first: Infinity,
            topics: [],
          };
          clusters.push(c);
        }
        c.domains.add(a.domain);
        if (a.sourcecountry) c.countries.add(a.sourcecountry);
        const t = gdeltDate(a.seendate || '');
        if (t < c.first) {
          c.first = t;
          c.title = a.title;
          c.url = a.url;
          c.domain = a.domain;
        }
        keys.forEach(k => {
          if (!c.topics.includes(k)) c.topics.push(k);
        });
      });
      stories.errors.news = null;
    } catch (e) {
      if (e.name === 'AbortError') return;
      stories.errors.news = e.message;
      if (Date.now() < gdelt.pausedUntil) break;
    }
    stories.news = new Map(clusters.map(c => [c.id, c]));
    bump();
  }
}
export async function loadLocalStories(entries: Entry[], signal: AbortSignal): Promise<void> {
  const cfg = store.get(LS.rss, { feeds: [], proxy: '' });
  if (!cfg.feeds.length) throw new Error('nofeeds');
  const items = (await loadFeedItems(cfg, signal)).filter(it => Date.now() - it.t < 48 * HOUR);
  const clusters = [];
  entries.forEach(E => {
    const re = topicRegex(queryOf(E).q);
    items
      .filter(it => re.test(it.text))
      .forEach(it => {
        const tk = toks(it.title);
        let c = tk.size >= 3 && clusters.find(c => jaccard(c.tk, tk) >= 0.34);
        if (!c) {
          c = {
            id: 'local:' + (it.link || it.title),
            title: it.title,
            url: it.link,
            domain: it.host,
            tk,
            domains: new Set(),
            countries: new Set(),
            first: it.t,
            topics: [],
          };
          clusters.push(c);
        }
        c.domains.add(it.host);
        if (it.t < c.first) {
          c.first = it.t;
          c.title = it.title;
          c.url = it.link;
          c.domain = it.host;
        }
        if (!c.topics.includes(E.key)) c.topics.push(E.key);
      });
  });
  stories.local = new Map(clusters.map(c => [c.id, c]));
  stories.errors.local =
    rssCache.errors && rssCache.errors.length ? 'some feeds failed: ' + rssCache.errors.join('; ') : null;
}
/** Matches the podcast catalogue against every topic in scope, by its name, search phrase and article title. */
export async function loadTGSStories(entries: Entry[], signal: AbortSignal): Promise<void> {
  const catalog = await loadTGSCatalog(signal);
  const matchers = entries.map(E => {
    const qq = queryOf(E);
    const terms = [...new Set([qq.q, E.name, qq.wiki].filter(Boolean).map(t => t.replace(/"/g, '').trim()))];
    return { key: E.key, res: terms.filter(t => t.length >= 2).map(topicRegex) };
  });
  const found = new Map<string, TGSMatch>();
  catalog.forEach(it => {
    let score = 0;
    const topics: string[] = [];
    matchers.forEach(m => {
      const s = tgsScore(it, m.res);
      if (s) {
        score += s;
        topics.push(m.key);
      }
    });
    if (topics.length) found.set(it.id, { ...it, topics, score });
  });
  stories.tgs = found;
  stories.tgsCount = catalog.length;
}
export async function loadStories() {
  if (storyAbort) storyAbort.abort();
  storyAbort = new AbortController();
  const { signal } = storyAbort,
    src = state.storySrc,
    entries = storyScopeEntries();
  stories.loading[src] = true;
  bump();
  try {
    if (src === 'hn') await loadHNStories(entries, signal);
    else if (src === 'local') await loadLocalStories(entries, signal);
    else if (src === 'tgs') {
      await loadTGSStories(entries, signal);
      stories.errors.tgs = null;
    } else await loadNewsStories(entries, signal);
    if (src === 'hn') stories.errors.hn = null;
    stories.at[src] = Date.now();
  } catch (e) {
    if (e.name !== 'AbortError') stories.errors[src] = e.message;
  }
  stories.loading[src] = false;
  if (!signal.aborted) bump();
}
export function startStoryTimer(): void {
  clearInterval(storyTimer);
  storyTimer = setInterval(() => {
    if (document.visibilityState === 'visible') loadStories();
  }, STORY_REFRESH_MS);
}

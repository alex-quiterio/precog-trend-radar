// PRECOG / Trend Radar · Rising stories: HN engagement velocity, GDELT and local-feed story clusters.
import type { Entry } from '../types';
import { HOUR, LS, MIN, STORY_REFRESH_MS, store } from '../core/config';
import { bump } from '../core/ui-store';
import { orderedEntries } from '../live';
import { gdelt, gdeltCall, gdeltDate } from '../sources/gdelt';
import { getJSON, phrase, pool, queryOf } from '../sources/registry';
import { loadFeedItems, rssCache, topicRegex } from '../sources/rss';
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
export const stories = {
  hn: new Map<string, HNStory>(),
  news: new Map<string, StoryCluster>(),
  local: new Map<string, StoryCluster>(),
  loading: { hn: false, news: false, local: false },
  errors: { hn: null, news: null, local: null },
  at: { hn: 0, news: 0, local: 0 },
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
export async function loadNewsStories(entries: Entry[], signal: AbortSignal): Promise<void> {
  const clusters = [];
  for (const E of entries) {
    if (signal.aborted) return;
    try {
      const qq = queryOf(E);
      const j = await gdeltCall(
        `mode=artlist&timespan=24h&maxrecords=75&sort=hybridrel&query=${encodeURIComponent(phrase(qq.q) + (qq.country ? ` sourcecountry:${qq.country}` : ''))}`,
        signal,
      );
      (j.articles || []).forEach(a => {
        const tk = toks(a.title);
        if (tk.size < 3) return;
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
        if (!c.topics.includes(E.key)) c.topics.push(E.key);
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
    else await loadNewsStories(entries, signal);
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

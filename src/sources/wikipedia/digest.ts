// PRECOG / Trend Radar · Today's stories: what is actually happening with each of a channel's topics.
// Three kinds, never dressed up as one another:
//   news      Wikipedia's "In the news" names it: the sentence its editors wrote, with the day.
//   headline  no such story, but in the last two days the Guardian ran an article on it (from the trend
//             fetch's cache, so no extra call): that headline.
//   quiet     neither: only what the topic is (its Wikipedia description). Its attention moved, but there is
//             no fresh story to tell, and an encyclopedia lead is not news.
// A channel can scope its stories to its own sites (`stories` in channels.ts): then neither "In the news" nor
// the Guardian is read, and a headline is a post from those sites naming the topic in its title, within the
// channel's window (Alt Amsterdam: Dutch news; The Marginalian: its own essays; Portugal: Portuguese sites).
// Each also says how far the topic's attention moved in a week, like a digest's trending terms, and links
// to a week of coverage. Calls: the day's feed (one, cached for the day) and one summary per topic (cached).
import { DAY, LS, store } from '@core/config';
import { getJSON, pool, queryOf, topicRegex, topicTerms } from '@sources/registry';
import { guardianArticles } from '@sources/guardian';
import { loadReading, type ReadingItem, type ReadingSite } from '@sources/reading';
import type { Entry } from '@/types';
import { resolveWikiTitle } from './index';
import { type NewsStory, type WikiSummary, lead, parseNewsStories, parseSummary } from './parse';

/** What a topic's row is made of. */
export interface TopicStory {
  key: string;
  summary: WikiSummary;
  /** The "In the news" story that names it, if any. */
  news: NewsStory | null;
  /** On a scoped channel: the newest post from its sites naming it in the title, within the window, if any. */
  post?: ReadingItem | null;
}
export type DigestData = Map<string, TopicStory>;

const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Today's "In the news" stories (English Wikipedia), cached for the day. Empty when the feed can't be read. */
async function newsStories(signal: AbortSignal, now = Date.now()): Promise<NewsStory[]> {
  const day = ymd(now);
  const cached = store.get<{ day: string; stories: NewsStory[] } | null>(LS.wikiNews, null);
  if (cached?.day === day && Array.isArray(cached.stories)) return cached.stories;
  const stories = parseNewsStories(
    await getJSON(`https://en.wikipedia.org/api/rest_v1/feed/featured/${day.replace(/-/g, '/')}`, signal),
  );
  store.set(LS.wikiNews, { day, stories });
  return stories;
}
/** An article's summary, cached for the day. */
async function summaryOf(title: string, lang: string, signal: AbortSignal, now = Date.now()) {
  const day = ymd(now),
    ck = `${lang}:${title}`;
  const cache = store.get<Record<string, { day: string; s: WikiSummary }>>(LS.wikiSummaries, {});
  if (cache[ck]?.day === day) return cache[ck].s;
  const s = parseSummary(
    await getJSON(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      signal,
    ),
  );
  // Only today's entries are kept, so the cache never grows past a day's topics.
  const fresh = Object.fromEntries(Object.entries(cache).filter(([, v]) => v?.day === day));
  store.set(LS.wikiSummaries, { ...fresh, [ck]: { day, s } });
  return s;
}

/** The "In the news" story about a topic: one linking its article, or naming it in its text. */
export function storyFor(stories: NewsStory[], title: string, q: string): NewsStory | null {
  const re = q.replace(/\s/g, '').length >= 4 ? topicRegex(q) : null;
  return stories.find(s => s.links.includes(title)) ?? (re && stories.find(s => re.test(s.text))) ?? null;
}

/** Where a scoped channel's stories come from: its sites, and how many days a post stays fresh. */
export interface StoryScope {
  sites: ReadingSite[];
  days: number;
}
/** The newest post naming a topic in its title (in any of its names, Portuguese too) from the last `days`. */
export function postFor(posts: ReadingItem[], E: Entry, now = Date.now(), days = 2): ReadingItem | null {
  const res = topicTerms(E).map(topicRegex);
  return (
    posts.filter(p => now - p.t < days * DAY && res.some(re => re.test(p.title))).sort((a, b) => b.t - a.t)[0] ?? null
  );
}
/** The newest posts from these sites in the last `days`, leaving out the ones in `skip` (already a topic's story). */
export function latestPosts(posts: ReadingItem[], skip: Set<string>, now = Date.now(), days = 2, n = 4): ReadingItem[] {
  return posts
    .filter(p => now - p.t < days * DAY && !skip.has(p.url))
    .sort((a, b) => b.t - a.t)
    .slice(0, n);
}
/** These sites' posts (from the Reading cache when fresh); none when they can't be read. */
export const sitePosts = (sites: ReadingSite[], signal: AbortSignal): Promise<ReadingItem[]> =>
  sites.length
    ? loadReading(signal, sites).then(
        r => r.items,
        () => [] as ReadingItem[],
      )
    : Promise.resolve([]);

/** How far a topic's attention moved in a week: the latest point against the one 7 days before (%), or null. */
export function weekChange(series: Entry['liveSeries']): number | null {
  const last = series[series.length - 1];
  if (!last) return null;
  const before = [...series].reverse().find(p => p.t <= last.t - 7 * DAY + DAY / 2);
  return before && before.value > 0 ? ((last.value - before.value) / before.value) * 100 : null;
}
/** A week of news coverage of a topic, as a search a reader can open. */
const coverageUrl = (q: string) =>
  `https://news.google.com/search?q=${encodeURIComponent(`"${q.replace(/"/g, '')}" when:7d`)}`;

/** One story of the digest, ready to draw. */
export interface DigestItem {
  key: string;
  kind: 'news' | 'headline' | 'quiet';
  /** What happened (news, headline); for a quiet topic, what it is. */
  text: string;
  /** Where the text links: the article, the Guardian's, or the site's post. */
  url: string;
  /** Who says so: "In the news · Nov 3", "The Guardian", a site ("Wilder"), or the topic's description. */
  source: string;
  /** When the headline ran (ms). */
  t: number | null;
  /** The topic's Wikipedia article, for background. */
  wiki: string;
  /** The topic's attention now (100 = its 30-day norm), and its change in a week (%). */
  now: number | null;
  week: number | null;
  coverage: string;
}
const RANK = { news: 0, headline: 1, quiet: 2 };
/**
 * The digest for these topics: the news, then fresh headlines, then quiet ones; within each, the biggest move
 * first. With a scope, headlines come only from its sites' posts (fresh for `days`), never the Guardian.
 */
export function digestItems(
  entries: Entry[],
  data: DigestData | undefined,
  now: number,
  scope?: Pick<StoryScope, 'days'>,
): DigestItem[] {
  return entries
    .flatMap(E => {
      const s = data?.get(E.key);
      if (!s) return [];
      const fresh = scope
        ? s.post && now - s.post.t < scope.days * DAY
          ? { title: s.post.title, url: s.post.url, t: s.post.t, source: s.post.site }
          : undefined
        : guardianArticles(queryOf(E).q)
            .filter(a => now - a.t < 2 * DAY)
            .sort((a, b) => b.t - a.t)
            .map(a => ({ title: a.title, url: a.url, t: a.t, source: 'The Guardian' }))[0];
      const base = {
        key: E.key,
        wiki: s.summary.url,
        now: E.liveSeries[E.liveSeries.length - 1]?.value ?? null,
        week: weekChange(E.liveSeries),
        coverage: coverageUrl(queryOf(E).q),
      };
      const item: DigestItem = s.news
        ? {
            ...base,
            kind: 'news',
            text: s.news.text,
            url: s.summary.url,
            source: `In the news${s.news.day ? ' · ' + s.news.day : ''}`,
            t: null,
          }
        : fresh
          ? { ...base, kind: 'headline', text: fresh.title, url: fresh.url, source: fresh.source, t: fresh.t }
          : {
              ...base,
              kind: 'quiet',
              text: s.summary.description || lead(s.summary.extract, 140),
              url: s.summary.url,
              source: '',
              t: null,
            };
      return [item];
    })
    .sort((a, b) => RANK[a.kind] - RANK[b.kind] || Math.abs(b.week ?? 0) - Math.abs(a.week ?? 0));
}

/**
 * Fetches what the digest needs for these topics: the world's news, or with a `scope`, its sites' posts.
 * Calls `show` as topics arrive; topics without an article are left out.
 */
export async function loadDigest(
  entries: Entry[],
  signal: AbortSignal,
  show: (partial: DigestData) => void = () => {},
  scope?: StoryScope,
): Promise<DigestData> {
  const map: DigestData = new Map();
  const [stories, posts] = await Promise.all([
    scope ? ([] as NewsStory[]) : newsStories(signal).catch(() => [] as NewsStory[]),
    scope ? sitePosts(scope.sites, signal) : ([] as ReadingItem[]),
  ]);
  const failed: string[] = [];
  await pool(entries, 4, async E => {
    try {
      const lang = E.lang || 'en';
      const known = typeof E.meta.wikiTitle === 'string' ? E.meta.wikiTitle : '';
      const title = known || (await resolveWikiTitle(E.def.wiki || E.name, signal, lang));
      const summary = await summaryOf(title, lang, signal);
      const news = lang === 'en' ? storyFor(stories, summary.title, queryOf(E).q) : null;
      const post = scope ? postFor(posts, E, Date.now(), scope.days) : null;
      map.set(E.key, { key: E.key, summary, news, post });
      show(new Map(map));
    } catch (e) {
      if (signal.aborted) throw e;
      failed.push(E.name);
    }
  });
  if (!map.size && failed.length) throw new Error(`no Wikipedia article for ${failed.join(', ')}`);
  return map;
}

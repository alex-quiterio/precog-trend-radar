// PRECOG / Trend Radar · Echoes: fetches today's signals of what the internet is talking about. The World
// channel picks its topics from these each day (see features/hot-topics.ts). No keys needed; with a key the
// Guardian's front joins in, both as a source of topics and as an echo. Every part is optional except
// Wikipedia's feed: without it there is no pick.
import { DAY } from '@core/config';
import { getJSON } from '@sources/registry';
import { guardianKey } from '@sources/guardian';
import { parseOpenSearch } from '@sources/wikipedia/parse';
import {
  type Feed,
  type FeedArticle,
  guardianTags,
  parseFeed,
  parseGuardianFront,
  parseWikiPages,
  parseHnTitles,
  parseManifoldQuestions,
  parseSparqlItems,
} from './parse';
export * from './parse';

/** A topic the Guardian's front keeps coming back to, with its Wikipedia article. */
export interface GuardianTopic {
  article: FeedArticle;
  /** How many of its editors' picks and most-viewed articles carry it. */
  picks: number;
  viewed: number;
}
export interface EchoSignals {
  feed: Feed;
  /** Only with a Guardian key: the topics its front keeps coming back to. */
  guardian?: GuardianTopic[];
  /** Headlines and questions from other corners of the internet, by where they were seen. */
  elsewhere: { hn: string[]; manifold: string[]; guardian: string[] };
}

const ymd = (t: number) => new Date(t).toISOString().slice(0, 10).replace(/-/g, '/');
const quietly = <T>(p: Promise<T>, fallback: T): Promise<T> => p.catch(() => fallback);

/** Wikipedia's feed for today, with yesterday's most-read list if today's isn't out yet. */
async function feed(now: number, signal: AbortSignal): Promise<Feed> {
  const url = (t: number) => `https://en.wikipedia.org/api/rest_v1/feed/featured/${ymd(t)}`;
  const today = parseFeed(await getJSON(url(now), signal));
  if (today.mostRead.length) return today;
  const before = parseFeed(await quietly(getJSON(url(now - DAY), signal), null));
  return { news: today.news.length ? today.news : before.news, mostRead: before.mostRead };
}
export async function fetchEchoSignals(signal: AbortSignal, now = Date.now()): Promise<EchoSignals> {
  const key = guardianKey();
  const [f, hn, manifold, guardian] = await Promise.all([
    feed(now, signal),
    quietly(
      getJSON('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=50&attributesToRetrieve=title', signal),
      null,
    ).then(parseHnTitles),
    quietly(
      getJSON(
        'https://api.manifold.markets/v0/search-markets?term=&sort=24-hour-vol&filter=open&contractType=BINARY&limit=100',
        signal,
      ),
      null,
    ).then(parseManifoldQuestions),
    key ? quietly(guardianFront(key, signal), null) : Promise.resolve(null),
  ]);
  return {
    feed: f,
    guardian: guardian?.topics,
    elsewhere: { hn, manifold, guardian: guardian?.headlines ?? [] },
  };
}

/**
 * The Guardian's international front: its editors' picks and most-viewed articles (one call). Their headlines
 * count as echoes; the tags they share become topics, each matched to its Wikipedia article (one more call).
 */
async function guardianFront(
  key: string,
  signal: AbortSignal,
): Promise<{ headlines: string[]; topics: GuardianTopic[] }> {
  const front = parseGuardianFront(
    await getJSON(
      `https://content.guardianapis.com/international?show-editors-picks=true&show-most-viewed=true&show-tags=keyword&page-size=1&api-key=${encodeURIComponent(key)}`,
      signal,
    ),
  );
  const headlines = [...front.picks, ...front.viewed].map(i => i.title);
  const tags = guardianTags(front).slice(0, 20);
  if (!tags.length) return { headlines, topics: [] };
  const pages = await wikiPages(
    tags.map(t => t.title),
    signal,
  );
  return {
    headlines,
    topics: tags.flatMap(t => {
      const article = pages.get(t.title);
      return article ? [{ article, picks: t.picks, viewed: t.viewed }] : [];
    }),
  };
}
const WIKI_API = 'https://en.wikipedia.org/w/api.php?format=json&origin=*&';
const pagesFor = async (titles: string[], signal: AbortSignal) =>
  parseWikiPages(
    await getJSON(
      WIKI_API +
        `action=query&redirects=1&prop=pageprops|description&ppprop=wikibase_item&titles=${encodeURIComponent(titles.join('|'))}`,
      signal,
    ),
  );
/** How Wikipedia would title a tag that ends in a year: "US midterm elections 2026" → "2026 United States midterm elections". */
export function wikiStyle(name: string): string | null {
  const m = name.match(/^(.+?)\s+((?:19|20)\d{2})$/);
  return m ? `${m[2]} ${m[1].replace(/^US\b/, 'United States').replace(/^UK\b/, 'United Kingdom')}` : null;
}
/**
 * The Wikipedia article for each of these names: exact titles, redirects and wikiStyle() rewrites in one
 * call; for up to eight names still without one, Wikipedia's search (a result must keep the name's year, so
 * "US midterm elections 2026" never lands on 2006), then one more call for their details.
 */
export async function wikiPages(names: string[], signal: AbortSignal): Promise<Map<string, FeedArticle>> {
  const asked = [...new Set(names.flatMap(n => [n, wikiStyle(n) ?? n]))];
  const pages = await pagesFor(asked, signal);
  const out = new Map<string, FeedArticle>();
  names.forEach(n => {
    const a = pages.get(n) ?? pages.get(wikiStyle(n) ?? n);
    if (a) out.set(n, a);
  });
  const misses = names.filter(n => !out.has(n)).slice(0, 8);
  const found = await Promise.all(
    misses.map(n =>
      quietly(
        getJSON(WIKI_API + `action=opensearch&namespace=0&limit=1&search=${encodeURIComponent(n)}`, signal),
        null,
      ).then(r => [n, r ? parseOpenSearch(r) : null] as const),
    ),
  );
  const year = (s: string) => s.match(/\b(?:19|20)\d{2}\b/)?.[0];
  const titles = found.filter(
    (f): f is readonly [string, string] => !!f[1] && (!year(f[0]) || year(f[1]) === year(f[0])),
  );
  if (titles.length) {
    const more = await quietly(
      pagesFor(
        titles.map(([, t]) => t),
        signal,
      ),
      new Map<string, FeedArticle>(),
    );
    titles.forEach(([n, t]) => more.get(t) && out.set(n, more.get(t)!));
  }
  return out;
}

/**
 * Which of these Wikidata items are people (or fictional characters), in one query. Throws when Wikidata
 * can't answer: the caller then keeps only what the article descriptions show isn't about a person.
 */
export async function peopleAmong(qids: string[], signal: AbortSignal): Promise<Set<string>> {
  const ids = [...new Set(qids.filter(q => /^Q\d+$/.test(q)))];
  if (!ids.length) return new Set();
  const query = `SELECT ?item WHERE { VALUES ?item { ${ids.map(q => 'wd:' + q).join(' ')} } ?item wdt:P31 ?c . VALUES ?c { wd:Q5 wd:Q15632617 wd:Q95074 } }`;
  return parseSparqlItems(
    await getJSON(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, signal),
  );
}

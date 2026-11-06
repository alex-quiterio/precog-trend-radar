// PRECOG / Trend Radar · Echoes: fetches today's signals of what the internet is talking about. The World
// channel picks its topics from these each day (see features/hot-topics.ts). No keys needed; the Guardian
// joins in when a key is set. Every part is optional except Wikipedia's feed: without it there is no pick.
import { DAY } from '@core/config';
import { getJSON } from '@sources/registry';
import { guardianKey } from '@sources/guardian';
import {
  type Feed,
  parseFeed,
  parseGuardianHeadlines,
  parseHnTitles,
  parseManifoldQuestions,
  parseSparqlItems,
} from './parse';
export * from './parse';

export interface EchoSignals {
  feed: Feed;
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
    key
      ? quietly(
          getJSON(
            `https://content.guardianapis.com/search?order-by=newest&page-size=50&api-key=${encodeURIComponent(key)}`,
            signal,
          ),
          null,
        ).then(parseGuardianHeadlines)
      : Promise.resolve([]),
  ]);
  return { feed: f, elsewhere: { hn, manifold, guardian } };
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

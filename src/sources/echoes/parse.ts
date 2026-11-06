// PRECOG / Trend Radar · Echoes: reading the replies that say what the internet is talking about today.
// Wikipedia's daily feed (its "In the news" stories and most-read articles), Wikidata's answer to "which of
// these are people", Hacker News's front page, Manifold's busiest markets and the Guardian's newest articles.
import { at, listOr, num, objOr, str } from '@sources/shape';

/** A Wikipedia article as the daily feed describes it. */
export interface FeedArticle {
  title: string;
  description: string;
  /** Its Wikidata id (Q…), used to ask whether it is about a person. */
  qid: string;
  /** Only most-read articles: yesterday's views, the rank, and the days before (oldest first). */
  views?: number;
  rank?: number;
  history?: number[];
}
export interface Feed {
  /** "In the news": each story with the articles it links to, in order. */
  news: FeedArticle[][];
  mostRead: FeedArticle[];
}

/** A feed entry as an article, or null for anything that isn't a plain encyclopedia article. */
function article(v: unknown): FeedArticle | null {
  const a = objOr(v);
  if ((a.type != null && a.type !== 'standard') || (a.namespace != null && num(at(a, 'namespace', 'id')) !== 0))
    return null;
  const title = (str(a.normalizedtitle) || str(a.title)).replace(/_/g, ' ').trim();
  if (!title) return null;
  const out: FeedArticle = { title, description: str(a.description), qid: str(a.wikibase_item) };
  const views = num(a.views);
  if (views != null) {
    out.views = views;
    out.rank = num(a.rank) ?? undefined;
    out.history = listOr(a.view_history)
      .map(h => num(at(h, 'views')))
      .filter((n): n is number => n != null);
  }
  return out;
}
/** Wikipedia's featured feed (/api/rest_v1/feed/featured/YYYY/MM/DD). Missing parts come back empty. */
export function parseFeed(reply: unknown): Feed {
  return {
    news: listOr(at(reply, 'news'))
      .map(s =>
        listOr(at(s, 'links'))
          .map(article)
          .filter((a): a is FeedArticle => !!a),
      )
      .filter(s => s.length),
    mostRead: listOr(at(reply, 'mostread', 'articles'))
      .map(article)
      .filter((a): a is FeedArticle => !!a && a.views != null),
  };
}
/** The Wikidata ids a SPARQL reply lists (its ?item column). */
export const parseSparqlItems = (reply: unknown): Set<string> =>
  new Set(
    listOr(at(reply, 'results', 'bindings'))
      .map(b => str(at(b, 'item', 'value')).replace(/^.*\/entity\//, ''))
      .filter(Boolean),
  );
/** Hacker News front-page titles (Algolia search with tags=front_page). */
export const parseHnTitles = (reply: unknown): string[] =>
  listOr(at(reply, 'hits'))
    .map(h => str(at(h, 'title')))
    .filter(Boolean);
/** Manifold market questions (search-markets). */
export const parseManifoldQuestions = (reply: unknown): string[] =>
  listOr(reply)
    .map(m => str(at(m, 'question')))
    .filter(Boolean);
/** A Guardian article with its keyword tags (what it is about). */
export interface GuardianItem {
  title: string;
  tags: { id: string; title: string; section: string }[];
}
/** The Guardian front's two lists: what its editors chose, and what readers read most. */
export interface GuardianFront {
  picks: GuardianItem[];
  viewed: GuardianItem[];
}
const guardianItem = (v: unknown): GuardianItem => ({
  title: str(at(v, 'webTitle')),
  tags: listOr(at(v, 'tags'))
    .filter(t => str(at(t, 'type')) === 'keyword')
    .map(t => ({ id: str(at(t, 'id')), title: str(at(t, 'webTitle')), section: str(at(t, 'sectionId')) }))
    .filter(t => t.id && t.title),
});
/** A Guardian edition front (/international?show-editors-picks=true&show-most-viewed=true&show-tags=keyword). */
export function parseGuardianFront(reply: unknown): GuardianFront {
  const r = at(reply, 'response');
  return {
    picks: listOr(at(r, 'editorsPicks'))
      .map(guardianItem)
      .filter(i => i.title),
    viewed: listOr(at(r, 'mostViewed'))
      .map(guardianItem)
      .filter(i => i.title),
  };
}
/** Guardian sections whose tags are sport, culture or lifestyle: popular, but not the news World is for. */
const GUARDIAN_SKIP_SECTIONS = new Set(
  'sport football culture film music tv-and-radio books stage artanddesign games fashion lifeandstyle food travel crosswords theguardian commentisfree media'.split(
    ' ',
  ),
);
/**
 * The topics the Guardian's front keeps coming back to: keyword tags on at least two of its editors' picks
 * and most-viewed articles, most first. Section tags ("World news", id world/world) and sport or culture
 * tags are left out.
 */
export function guardianTags(front: GuardianFront): { title: string; picks: number; viewed: number }[] {
  const count = new Map<string, { title: string; picks: number; viewed: number }>();
  const tally = (items: GuardianItem[], key: 'picks' | 'viewed') =>
    items.forEach(i =>
      new Set(
        i.tags
          .filter(t => !GUARDIAN_SKIP_SECTIONS.has(t.section))
          .filter(t => {
            const [a, b] = t.id.split('/');
            return a !== b; // world/world, uk/uk: a whole section, not a topic
          })
          .map(t => t.title),
      ).forEach(title => {
        const c = count.get(title) ?? { title, picks: 0, viewed: 0 };
        c[key]++;
        count.set(title, c);
      }),
    );
  tally(front.picks, 'picks');
  tally(front.viewed, 'viewed');
  return [...count.values()]
    .filter(c => c.picks + c.viewed >= 2)
    .sort((a, b) => b.picks + b.viewed - (a.picks + a.viewed));
}
/**
 * Wikipedia articles for a batch of titles (action=query&prop=pageprops|description), by the title asked
 * for, following redirects. Titles without an article are missing from the map.
 */
export function parseWikiPages(reply: unknown): Map<string, FeedArticle> {
  const q = objOr(at(reply, 'query'));
  const hops = new Map<string, string>();
  [...listOr(q.normalized), ...listOr(q.redirects)].forEach(r => hops.set(str(at(r, 'from')), str(at(r, 'to'))));
  const byTitle = new Map<string, FeedArticle>();
  Object.values(objOr(q.pages)).forEach(p => {
    const page = objOr(p);
    if ('missing' in page || 'invalid' in page || num(page.ns) !== 0) return;
    const title = str(page.title);
    byTitle.set(title, { title, description: str(page.description), qid: str(at(page, 'pageprops', 'wikibase_item')) });
  });
  const out = new Map<string, FeedArticle>();
  const asked = new Set([...hops.keys(), ...byTitle.keys()]);
  asked.forEach(a => {
    let t = a;
    for (let i = 0; i < 3 && hops.has(t); i++) t = hops.get(t)!;
    const page = byTitle.get(t);
    if (page) out.set(a, page);
  });
  return out;
}

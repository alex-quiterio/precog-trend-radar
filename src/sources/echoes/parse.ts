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
/** Guardian headlines (content search). */
export const parseGuardianHeadlines = (reply: unknown): string[] =>
  listOr(at(reply, 'response', 'results'))
    .map(r => str(at(r, 'webTitle')))
    .filter(Boolean);

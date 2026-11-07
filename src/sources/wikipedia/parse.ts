// PRECOG / Trend Radar · Wikipedia: reading pageview and title replies.
import { ShapeError, at, list, listOr, num, obj, objOr, str } from '@sources/shape';

/** Wikimedia's per-article pageviews reply as daily points. Days without a count are skipped. */
export function parsePageviews(reply: unknown): { t: string; value: number }[] {
  return listOr(at(reply, 'items')).flatMap(it => {
    const ts = str(at(it, 'timestamp')),
      views = num(at(it, 'views'));
    if (!/^\d{8}/.test(ts) || views == null) return [];
    return [{ t: `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T00:00:00Z`, value: views }];
  });
}
/** The article a title query lands on (following redirects), or null when it is missing or invalid. */
export function parseTitleQuery(reply: unknown): string | null {
  const page = objOr(Object.values(objOr(at(reply, 'query', 'pages')))[0]);
  return page.title && !('missing' in page) && !('invalid' in page) ? str(page.title) || null : null;
}
/** The first title of an opensearch reply ([query, [titles], …]), or null. */
export const parseOpenSearch = (reply: unknown): string | null =>
  str(listOr(list(reply, 'Wikipedia search')[1])[0]) || null;

/** An article's summary: its one-line description and its lead paragraph. */
export interface WikiSummary {
  title: string;
  description: string;
  extract: string;
  url: string;
}
/** The page summary reply (/api/rest_v1/page/summary/Title). Disambiguation and missing pages are refused. */
export function parseSummary(reply: unknown): WikiSummary {
  const r = obj(reply, 'Wikipedia summary');
  const title = str(r.title),
    extract = str(r.extract).trim();
  if (str(r.type) && str(r.type) !== 'standard') throw new ShapeError('Wikipedia summary', `a ${str(r.type)} page`);
  if (!title || !extract) throw new ShapeError('Wikipedia summary', 'no extract');
  return {
    title,
    description: str(r.description),
    extract,
    url:
      str(at(r, 'content_urls', 'desktop', 'page')) ||
      `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
  };
}

/** A story from Wikipedia's "In the news", as one plain sentence, with the articles it links to. */
export interface NewsStory {
  text: string;
  /** The day it was posted ("Nov 3"), as the feed's comment gives it, or ''. */
  day: string;
  /** Linked article titles, with spaces. */
  links: string[];
}
/** HTML to plain text: no comments or tags, entities decoded, "(pictured)" dropped. */
export const plainText = (html: string): string =>
  html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, '’')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s*\((pictured|shown)\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
/** The "In the news" stories of Wikipedia's featured feed. Stories without text are skipped. */
export const parseNewsStories = (reply: unknown): NewsStory[] =>
  listOr(at(reply, 'news')).flatMap(s => {
    const html = str(at(s, 'story'));
    const text = plainText(html);
    if (!text) return [];
    return [
      {
        text,
        day: /^\s*<!--\s*([^>]*?)\s*-->/.exec(html)?.[1] ?? '',
        links: listOr(at(s, 'links'))
          .map(l => (str(at(l, 'normalizedtitle')) || str(at(l, 'title'))).replace(/_/g, ' '))
          .filter(Boolean),
      },
    ];
  });

/** The first sentences of a lead, up to about `max` characters (whole sentences when they fit). */
export function lead(extract: string, max = 240): string {
  const sentences = extract.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? [extract];
  let out = '';
  for (const s of sentences) {
    if (out && (out + s).length > max) break;
    out += s;
  }
  out = out.trim();
  return out.length <= max ? out : out.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

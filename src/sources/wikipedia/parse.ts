// PRECOG / Trend Radar · Wikipedia: reading pageview and title replies.
import { at, list, listOr, num, objOr, str } from '@sources/shape';

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

// PRECOG / Trend Radar · The Guardian: reading content-search replies.
import { at, listOr, num, obj, str } from '@sources/shape';

/** A Guardian article naming a topic, kept from the same requests that count coverage. */
export interface GuardianArticle {
  id: string;
  title: string;
  url: string;
  section: string;
  t: number;
}
/** One result of a Guardian search, as PRECOG uses it. */
export interface GuardianResult extends GuardianArticle {
  /** 'article', 'liveblog', 'gallery'… only articles are listed; everything counts toward coverage. */
  type: string;
}
/** A Guardian search reply: how many pages it has, and its results (those without a valid date are skipped). */
export function parseGuardianPage(reply: unknown): { pages: number; results: GuardianResult[] } {
  const r = obj(obj(reply, 'The Guardian').response, 'The Guardian', 'response');
  return {
    pages: num(r.pages) || 1,
    results: listOr(r.results).flatMap(a => {
      const t = Date.parse(str(at(a, 'webPublicationDate')));
      if (!Number.isFinite(t)) return [];
      return [
        {
          id: str(at(a, 'id')),
          title: str(at(a, 'webTitle')),
          url: str(at(a, 'webUrl')),
          section: str(at(a, 'sectionName')),
          type: str(at(a, 'type')),
          t,
        },
      ];
    }),
  };
}

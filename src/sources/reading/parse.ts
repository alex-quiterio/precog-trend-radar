// PRECOG / Trend Radar · Reading: the site and post shapes, reading WordPress replies, and topic matching.
import { at, list, num, str } from '@sources/shape';

const TEXT_MAX = 1200; // enough to match topics; keeps the cache well inside browser storage

export interface ReadingSite {
  /** Site origin, e.g. https://www.themarginalian.org */
  url: string;
  name: string;
  /** WordPress post types to read, with the label each shows as. */
  types: [string, string][];
  /** Page slugs to watch for updates (shown with their last-changed date). */
  pages?: string[];
}
export interface ReadingItem {
  id: string;
  /** The followed site's origin, used to pick a channel's sites. */
  origin: string;
  site: string;
  kind: string;
  num: number | null;
  title: string;
  url: string;
  t: number;
  /** Lower-cased description, used only for matching. */
  text: string;
}

/** A WordPress REST posts reply (`/wp/v2/<type>`) as reading items. Posts without a date or link are skipped. */
export function parseWpPosts(reply: unknown, site: ReadingSite, type: string, label: string): ReadingItem[] {
  return list(reply, site.name, 'post list').flatMap(p => {
    const link = str(at(p, 'link')),
      t = Date.parse(str(at(p, 'date_gmt')) + 'Z');
    if (!link || !Number.isFinite(t)) return [];
    const slug = link.split('/').filter(Boolean).pop() || '';
    const n = /^(\d+)-/.exec(slug);
    return [
      {
        id: `rd:${site.url}:${type}:${num(at(p, 'id')) ?? link}`,
        origin: site.url,
        site: site.name,
        kind: label,
        num: n ? +n[1] : null,
        title: squash(plain(str(at(p, 'title', 'rendered')))),
        url: link,
        t,
        text: squash(plain(str(at(p, 'content', 'rendered'))))
          .slice(0, TEXT_MAX)
          .toLowerCase(),
      },
    ];
  });
}

/** How strongly an item matches a topic: 3 for a title hit, 1 for a description hit, 0 for none. */
export function readingScore(it: { title: string; text: string }, res: RegExp[]): number {
  if (res.some(re => re.test(it.title))) return 3;
  return res.some(re => re.test(it.text)) ? 1 : 0;
}

/** Text content of an HTML fragment. */
export const plain = (html: string): string => {
  const s = String(html || '');
  if (typeof DOMParser === 'undefined') return s.replace(/<[^>]+>/g, ' ');
  return new DOMParser().parseFromString(s, 'text/html').body.textContent || '';
};
/** Collapses whitespace. */
export const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

// PRECOG / Trend Radar · The Great Simplification (Nate Hagens): the podcast catalogue, matched to your topics.
// Reads the site's public WordPress API (it allows browser reads), episodes and Frankly monologues,
// and keeps a compact copy for 12 h. Not a trend series: a slow, deep stream to set beside the fast news.
import { HOUR, store } from '../core/config';
import { withTimeout } from './registry';

const API = 'https://www.thegreatsimplification.com/wp-json/wp/v2/';
const KINDS = [
  ['episode', 'Episode'],
  ['frankly-original', 'Frankly'],
] as const;
const CACHE_KEY = 'precog.tgs.v1';
const TTL = 12 * HOUR;
const TEXT_MAX = 2500;

export interface TGSItem {
  id: string;
  kind: 'Episode' | 'Frankly';
  num: number | null;
  title: string;
  url: string;
  t: number;
  /** Lower-cased description, used only for matching. */
  text: string;
}

const plain = (html: string): string => {
  const s = String(html || '');
  if (typeof DOMParser === 'undefined') return s.replace(/<[^>]+>/g, ' ');
  return new DOMParser().parseFromString(s, 'text/html').body.textContent || '';
};
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

async function fetchKind(type: string, label: TGSItem['kind'], signal: AbortSignal): Promise<TGSItem[]> {
  const items: TGSItem[] = [];
  for (let page = 1, pages = 1; page <= pages && page <= 10; page++) {
    const r = await fetch(
      `${API}${type}?per_page=100&page=${page}&orderby=date&order=desc&_fields=id,date_gmt,link,title,content`,
      { signal: withTimeout(signal, 30000) },
    );
    if (!r.ok) throw new Error(`thegreatsimplification.com: HTTP ${r.status}`);
    pages = Number(r.headers.get('X-WP-TotalPages')) || 1;
    const rows = await r.json();
    rows.forEach(p => {
      const slug =
        String(p.link || '')
          .split('/')
          .filter(Boolean)
          .pop() || '';
      const num = /^(\d+)-/.exec(slug);
      items.push({
        id: `tgs:${type}:${p.id}`,
        kind: label,
        num: num ? +num[1] : null,
        title: squash(plain(p.title?.rendered)),
        url: p.link,
        t: Date.parse(p.date_gmt + 'Z'),
        text: squash(plain(p.content?.rendered)).slice(0, TEXT_MAX).toLowerCase(),
      });
    });
  }
  return items;
}

let memory: { at: number; items: TGSItem[] } | null = null;
/** The whole catalogue, newest first. About 5 requests, then cached for 12 h. */
export async function loadTGSCatalog(signal: AbortSignal): Promise<TGSItem[]> {
  if (memory && Date.now() - memory.at < TTL) return memory.items;
  const c = store.get<{ at: number; items: TGSItem[] } | null>(CACHE_KEY, null);
  if (c && Date.now() - c.at < TTL && c.items?.length) return (memory = c).items;
  const lists = await Promise.all(KINDS.map(([type, label]) => fetchKind(type, label, signal)));
  const items = lists.flat().sort((a, b) => b.t - a.t);
  memory = { at: Date.now(), items };
  store.set(CACHE_KEY, memory);
  return items;
}

/** How strongly an item matches a topic: 3 for a title hit, 1 for a description hit, 0 for none. */
export function tgsScore(it: TGSItem, res: RegExp[]): number {
  if (res.some(re => re.test(it.title))) return 3;
  return res.some(re => re.test(it.text)) ? 1 : 0;
}

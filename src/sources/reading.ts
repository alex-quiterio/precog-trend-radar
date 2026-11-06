// PRECOG / Trend Radar · Reading: posts from sites you follow, matched to your topics.
// Works with any WordPress site whose public API allows browser reads (most do), e.g. The Great
// Simplification and The Marginalian. Each site is read once every 12 h and kept in this browser.
import { shallowRef } from 'vue';
import { HOUR, store } from '../core/config';
import { withTimeout } from './registry';

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

const SITES_KEY = 'precog.reading.sites.v1';
const CACHE_KEY = 'precog.reading.v3.';
const TTL = 12 * HOUR;
const TEXT_MAX = 1200; // enough to match topics; keeps the cache well inside browser storage
const PAGES_PER_TYPE = 2; // newest 200 per type: enough to match against, light on the site

export const DEFAULT_SITES: ReadingSite[] = [
  {
    url: 'https://www.thegreatsimplification.com',
    name: 'The Great Simplification',
    types: [
      ['episode', 'Episode'],
      ['frankly-original', 'Frankly'],
    ],
    pages: ['resources'],
  },
  { url: 'https://www.themarginalian.org', name: 'The Marginalian', types: [['posts', 'Essay']] },
];
// Held in a ref (and mirrored to storage) so views listing the sites update when you follow one.
const sites = shallowRef<ReadingSite[]>(store.get(SITES_KEY, DEFAULT_SITES));
export const readingSites = (): ReadingSite[] => sites.value;
export function saveReadingSites(list: ReadingSite[]): void {
  sites.value = list;
  store.set(SITES_KEY, list);
}

const plain = (html: string): string => {
  const s = String(html || '');
  if (typeof DOMParser === 'undefined') return s.replace(/<[^>]+>/g, ' ');
  return new DOMParser().parseFromString(s, 'text/html').body.textContent || '';
};
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
const api = (site: ReadingSite) => `${site.url.replace(/\/+$/, '')}/wp-json/wp/v2/`;

/** Checks a URL is a WordPress site the browser may read, and names it from its own title. */
export async function probeSite(raw: string, signal?: AbortSignal): Promise<ReadingSite> {
  let origin: string;
  try {
    origin = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`).origin;
  } catch {
    throw new Error('that is not a web address');
  }
  let name = new URL(origin).hostname.replace(/^www\./, '');
  try {
    const r = await fetch(`${origin}/wp-json/`, { signal: withTimeout(signal, 15000) });
    if (!r.ok) throw new Error();
    name = squash(plain((await r.json()).name || '')) || name;
  } catch {
    throw new Error(`${name} can't be read from the browser (only WordPress sites with an open API work)`);
  }
  return { url: origin, name, types: [['posts', 'Post']] };
}

async function fetchType(site: ReadingSite, type: string, label: string, signal: AbortSignal) {
  const items: ReadingItem[] = [];
  for (let page = 1, pages = 1; page <= pages && page <= PAGES_PER_TYPE; page++) {
    const r = await fetch(
      `${api(site)}${type}?per_page=100&page=${page}&orderby=date&order=desc&_fields=id,date_gmt,link,title,content`,
      { signal: withTimeout(signal, 30000) },
    );
    if (!r.ok) throw new Error(`${site.name}: HTTP ${r.status}`);
    pages = Number(r.headers.get('X-WP-TotalPages')) || 1;
    (await r.json()).forEach(p => {
      const slug =
        String(p.link || '')
          .split('/')
          .filter(Boolean)
          .pop() || '';
      const num = /^(\d+)-/.exec(slug);
      items.push({
        id: `rd:${site.url}:${type}:${p.id}`,
        origin: site.url,
        site: site.name,
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
async function fetchPages(site: ReadingSite, signal: AbortSignal): Promise<ReadingItem[]> {
  if (!site.pages?.length) return [];
  const r = await fetch(
    `${api(site)}pages?slug=${site.pages.map(encodeURIComponent).join(',')}&_fields=id,modified_gmt,link,title,content`,
    { signal: withTimeout(signal, 30000) },
  );
  if (!r.ok) return [];
  return (await r.json()).map(p => ({
    id: `rd:${site.url}:page:${p.id}`,
    origin: site.url,
    site: site.name,
    kind: 'Page updated',
    num: null,
    title: squash(plain(p.title?.rendered)),
    url: p.link,
    t: Date.parse(p.modified_gmt + 'Z'),
    text: squash(plain(p.content?.rendered)).slice(0, TEXT_MAX).toLowerCase(),
  }));
}

const memory = new Map<string, { at: number; items: ReadingItem[] }>();
async function loadSite(site: ReadingSite, signal: AbortSignal): Promise<ReadingItem[]> {
  const key = CACHE_KEY + site.url;
  const m = memory.get(key);
  if (m && Date.now() - m.at < TTL) return m.items;
  const c = store.get<{ at: number; items: ReadingItem[] } | null>(key, null);
  if (c && Date.now() - c.at < TTL && c.items?.length) {
    memory.set(key, c);
    return c.items;
  }
  const lists = await Promise.all([
    ...site.types.map(([type, label]) => fetchType(site, type, label, signal)),
    fetchPages(site, signal),
  ]);
  const entry = { at: Date.now(), items: lists.flat() };
  memory.set(key, entry);
  store.set(key, entry);
  return entry.items;
}

/** Every followed site's recent posts, newest first. One failing site doesn't hide the others. */
export async function loadReading(signal: AbortSignal): Promise<{ items: ReadingItem[]; errors: string[] }> {
  const errors: string[] = [];
  const lists = await Promise.all(
    readingSites().map(site =>
      loadSite(site, signal).catch(e => {
        if (e.name === 'AbortError') throw e;
        errors.push(`${site.name}: ${e.message}`);
        return [] as ReadingItem[];
      }),
    ),
  );
  return { items: lists.flat().sort((a, b) => b.t - a.t), errors };
}

/** How strongly an item matches a topic: 3 for a title hit, 1 for a description hit, 0 for none. */
export function readingScore(it: { title: string; text: string }, res: RegExp[]): number {
  if (res.some(re => re.test(it.title))) return 3;
  return res.some(re => re.test(it.text)) ? 1 : 0;
}

// PRECOG / Trend Radar · Reading: posts from sites you follow, matched to your topics.
// Works with any WordPress site whose public API allows browser reads (most do), e.g. The Great
// Simplification and The Marginalian. Each site is read once every 12 h and kept in this browser.
import { shallowRef } from 'vue';
import { HOUR, store } from '@core/config';
import { errorText, isAbort } from '@core/errors';
import { HttpError, withTimeout } from '@sources/registry';
import { at, isObj, list, str } from '@sources/shape';
import { CAMPFIRE_FILMS } from './campfire';
import { libraryItems, parseWpPosts, plain, squash } from './parse';
import type { ReadingSite, ReadingItem } from './parse';
export * from './parse';

const SITES_KEY = 'precog.reading.sites.v1';
const CACHE_KEY = 'precog.reading.v3.';
const TTL = 12 * HOUR;
const PAGES_PER_TYPE = 2; // newest 200 per type: enough to match against, light on the site

/** Always followed: they can't be removed, and come back for anyone who removed them in an older version. */
const TGS: ReadingSite = {
  url: 'https://www.thegreatsimplification.com',
  name: 'The Great Simplification',
  types: [
    ['episode', 'Episode'],
    ['frankly-original', 'Frankly'],
  ],
  pages: ['resources'],
};
export const BUILT_IN_SITES: ReadingSite[] = [
  TGS,
  { url: 'https://www.themarginalian.org', name: 'The Marginalian', types: [['posts', 'Essay']] },
];
export const isBuiltInSite = (url: string): boolean => BUILT_IN_SITES.some(s => s.url === url);
/**
 * Sites a channel reads without you following them (see `sites` in channels.ts): they load only on that
 * channel, so other channels never pay for them. Alt Amsterdam reads the commons and repair movement (and
 * scores its daily topics on them, see features/scene-topics.ts).
 */
export const AMSTERDAM_SITES: ReadingSite[] = [
  { url: 'https://www.commonsnetwork.org', name: 'Commons Network', types: [['posts', 'Post']] },
  { url: 'https://www.shareable.net', name: 'Shareable', types: [['posts', 'Story']] },
  { url: 'https://www.repaircafe.org', name: 'Repair Café', types: [['posts', 'News']] },
  { url: 'https://www.resilience.org', name: 'Resilience', types: [['posts', 'Article']] },
];
/** Portugal & the land reads Portuguese nature, environment and farming news (matched by the topics' `also` names). */
export const PORTUGAL_SITES: ReadingSite[] = [
  { url: 'https://wilder.pt', name: 'Wilder', types: [['posts', 'Story']] },
  { url: 'https://greensavers.sapo.pt', name: 'Green Savers', types: [['posts', 'Article']] },
  { url: 'https://www.agroportal.pt', name: 'Agroportal', types: [['posts', 'News']] },
];
/**
 * Campfire Stories' films (Stephen Jenkinson, Charles Eisenstein, forests, gift economy, biodynamic farming).
 * The site can't be read from the browser, so its film library is kept here.
 */
export const CAMPFIRE: ReadingSite = {
  url: 'https://www.campfire-stories.org',
  name: 'Campfire Stories',
  types: [],
  library: { kind: 'Film', entries: CAMPFIRE_FILMS },
};
/**
 * The Great Turning reads the shift to a life-sustaining world as one: The Great Simplification on what is
 * ending, Local Futures on the local economies being built, and Campfire Stories' films on the stories that
 * carry us. Adding a voice to the channel is a line here.
 */
export const TURNING_SITES: ReadingSite[] = [
  TGS,
  { url: 'https://www.localfutures.org', name: 'Local Futures', types: [['posts', 'Article']] },
  CAMPFIRE,
];
/** News sites that tell a channel's Today's stories (see `stories` in channels.ts); they aren't Reading stream sites. */
export const NEWS_SITES: ReadingSite[] = [
  // English-language news about the Netherlands, a dozen posts a day: the newest 100, read every two hours.
  { url: 'https://www.dutchnews.nl', name: 'DutchNews.nl', types: [['posts', 'News']], ttlHours: 2, depth: 1 },
];
export const CHANNEL_SITES: ReadingSite[] = [...AMSTERDAM_SITES, ...PORTUGAL_SITES, ...NEWS_SITES, ...TURNING_SITES];
/** A followed or channel site by its origin. */
export const siteByUrl = (url: string): ReadingSite | undefined =>
  [...readingSites(), ...CHANNEL_SITES].find(s => s.url === url);
const validSite = (s: unknown): s is ReadingSite =>
  isObj(s) && typeof s.url === 'string' && typeof s.name === 'string' && Array.isArray(s.types);
/** The sites you added yourself. Storage only ever holds these; the built-in ones are added on read. */
const ownSites = (stored: unknown): ReadingSite[] =>
  Array.isArray(stored) ? stored.filter(validSite).filter(s => !isBuiltInSite(s.url)) : [];
// Held in a ref (and mirrored to storage) so views listing the sites update when you follow one.
const own = shallowRef<ReadingSite[]>(ownSites(store.get<unknown>(SITES_KEY, [])));
/** Every followed site: the built-in ones first, then yours. */
export const readingSites = (): ReadingSite[] => [...BUILT_IN_SITES, ...own.value];
/** Reads the followed sites from storage again (after storage changed underneath, e.g. in tests). */
export function reloadReadingSites(): void {
  own.value = ownSites(store.get<unknown>(SITES_KEY, []));
}
/** Saves the followed sites. Built-in sites are always kept, whatever the list says. */
export function saveReadingSites(sites: ReadingSite[]): void {
  own.value = ownSites(sites);
  store.set(SITES_KEY, own.value);
}

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
    name = squash(plain(str(at(await r.json(), 'name')))) || name;
  } catch {
    throw new Error(`${name} can't be read from the browser (only WordPress sites with an open API work)`);
  }
  return { url: origin, name, types: [['posts', 'Post']] };
}

async function fetchType(site: ReadingSite, type: string, label: string, signal: AbortSignal) {
  const items: ReadingItem[] = [];
  for (let page = 1, pages = 1; page <= pages && page <= (site.depth ?? PAGES_PER_TYPE); page++) {
    const r = await fetch(
      `${api(site)}${type}?per_page=100&page=${page}&orderby=date&order=desc&_fields=id,date_gmt,link,title,content`,
      { signal: withTimeout(signal, 30000) },
    );
    if (!r.ok) throw new HttpError(r.status); // loadReading names the site
    pages = Number(r.headers.get('X-WP-TotalPages')) || 1;
    items.push(...parseWpPosts(await r.json(), site, type, label));
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
  // Pages are listed with their last change, so date_gmt is read from modified_gmt.
  return parseWpPosts(
    list(await r.json(), site.name, 'page list').map(p => ({
      ...(isObj(p) ? p : {}),
      date_gmt: at(p, 'modified_gmt'),
    })),
    site,
    'page',
    'Page updated',
  );
}

const memory = new Map<string, { at: number; items: ReadingItem[] }>();
async function loadSite(site: ReadingSite, signal: AbortSignal): Promise<ReadingItem[]> {
  if (site.library) return libraryItems(site);
  const key = CACHE_KEY + site.url;
  const ttl = site.ttlHours ? site.ttlHours * HOUR : TTL;
  const m = memory.get(key);
  if (m && Date.now() - m.at < ttl) return m.items;
  const c = store.get<{ at: number; items: ReadingItem[] } | null>(key, null);
  if (c && Date.now() - c.at < ttl && c.items?.length) {
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

/** These sites' recent posts (every followed site by default), newest first. One failing site doesn't hide the others. */
export async function loadReading(
  signal: AbortSignal,
  sites: ReadingSite[] = readingSites(),
): Promise<{ items: ReadingItem[]; errors: string[] }> {
  const errors: string[] = [];
  const lists = await Promise.all(
    sites.map(site =>
      loadSite(site, signal).catch((e: unknown) => {
        if (isAbort(e)) throw e;
        errors.push(`${site.name}: ${errorText(e)}`);
        return [] as ReadingItem[];
      }),
    ),
  );
  return { items: lists.flat().sort((a, b) => b.t - a.t), errors };
}

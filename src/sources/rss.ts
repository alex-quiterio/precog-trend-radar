// PRECOG / Trend Radar · RSS/Atom feeds: per-day mention counts and the PT/NL feed presets.
import { DAY, MIN } from '../core/config';
import { iso, registerAdapter, utcDay } from './registry';

// --- RSS ------------------------------------------------------------------
export const FEED_PRESETS = [
  'https://www.rtp.pt/noticias/rss',
  'https://feeds.feedburner.com/PublicoRSS',
  'https://observador.pt/feed/',
  'https://feeds.nos.nl/nosnieuwsalgemeen',
  'https://www.nu.nl/rss/Algemeen',
  'https://www.dutchnews.nl/feed/',
  'https://nltimes.nl/rssfeed2',
];
export const topicRegex = q => {
  const n = String(q).replace(/"/g, '').trim();
  return new RegExp(`(^|[^\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}\\p{N}])`, 'iu');
};
export interface FeedItem {
  t: number;
  title: string;
  link: string;
  host: string;
  text: string;
}
export const rssCache = { at: 0, key: '', items: [] as FeedItem[], errors: [] as string[] };
export async function loadFeedItems(cfg, signal) {
  const key = JSON.stringify(cfg);
  if (rssCache.key === key && Date.now() - rssCache.at < 10 * MIN) return rssCache.items;
  const items = [],
    errors = [];
  await Promise.all(
    cfg.feeds.map(async url => {
      try {
        const r = await fetch(cfg.proxy ? cfg.proxy + encodeURIComponent(url) : url, { signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const doc = new DOMParser().parseFromString(await r.text(), 'text/xml');
        const host = /PublicoRSS/i.test(url) ? 'publico.pt' : new URL(url).hostname.replace(/^(www|feeds)\./, '');
        doc.querySelectorAll('item, entry').forEach(el => {
          const get = sel => el.querySelector(sel)?.textContent || '';
          const t = Date.parse(get('pubDate') || get('published') || get('updated') || get('date'));
          const link = el.querySelector('link')?.getAttribute('href') || get('link');
          const title = get('title').trim();
          if (!isNaN(t)) items.push({ t, title, link, host, text: `${title} ${get('description')} ${get('summary')}` });
        });
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        errors.push(
          `${new URL(url).hostname}: ${e.message === 'Failed to fetch' ? 'blocked (needs the proxy)' : e.message}`,
        );
      }
    }),
  );
  if (!items.length && errors.length) {
    // Every feed failing the same way through the proxy means the proxy itself was unreachable.
    if (cfg.proxy && errors.every(e => e.endsWith('blocked (needs the proxy)')))
      throw new Error(
        `can't reach the proxy at ${cfg.proxy.replace(/\?.*$/, '')}. Is \`npm run proxy\` running? ` +
          'In Chrome, also allow this site to reach apps on your device: click the icon left of the address, ' +
          'then Site settings → Local network access (or "Apps on device") → Allow',
      );
    throw new Error(errors.join('; '));
  }
  Object.assign(rssCache, { at: Date.now(), key, items, errors });
  return items;
}
registerAdapter({
  id: 'rss',
  label: 'RSS mentions / day',
  unit: 'mentions',
  concurrency: 4,
  async fetch(topic, { signal, config, query }) {
    const cfg = config.rss || { feeds: [] };
    if (!cfg.feeds.length) throw new Error('add at least one feed under "Feeds…"');
    const items = await loadFeedItems(cfg, signal);
    const re = topicRegex(query.q || topic);
    const days = 30,
      end = utcDay() + DAY,
      counts = new Array(days).fill(0);
    items.forEach(it => {
      const k = Math.floor((it.t - (end - days * DAY)) / DAY);
      if (k >= 0 && k < days && re.test(it.text)) counts[k]++;
    });
    return { topic, points: counts.map((value, k) => ({ t: iso(end - (days - k) * DAY), value })) };
  },
});

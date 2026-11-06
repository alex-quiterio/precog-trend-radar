// PRECOG / Trend Radar · Browser tests never touch the real APIs (they rate-limit and change, which would make
// CI fail at random). Every outside request is answered here: from the saved replies in src/sources/*/fixtures,
// or generated where a test needs data that names the channel's topics. Anything unknown is refused.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page, Route } from '@playwright/test';

const DAY = 86400e3;
const fixture = (source: string, name: string): unknown =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../src/sources/${source}/fixtures/${name}.json`, import.meta.url)), 'utf8'),
  );
const json = (route: Route, body: unknown) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  });

/** The topic that spikes in the generated pageviews, so the gist and the movers table show an alert. */
export const SPIKING = 'Tariffs';
/** Its Wikipedia article (the World channel's Tariffs topic reads the article “Tariff”). */
const SPIKING_ARTICLE = 'Tariff';

/** Wikipedia pageviews between the dates in the URL: a steady count, and a 3× spike on the last day for SPIKING. */
function pageviews(url: URL) {
  // …/per-article/{project}/{access}/{agent}/{article}/daily/{from}/{to}
  const parts = url.pathname.split('/');
  const [article, , from, to] = parts.slice(-4);
  const title = decodeURIComponent(article).replace(/_/g, ' ');
  const day = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
  const items = [];
  for (let t = day(from), i = 0; t <= day(to); t += DAY, i++) {
    const last = t + DAY > day(to);
    const views = Math.round(1000 + 40 * Math.sin(i / 2) + (last && title === SPIKING_ARTICLE ? 2000 : 0));
    const d = new Date(t).toISOString().slice(0, 10).replace(/-/g, '');
    items.push({ article, timestamp: `${d}00`, views });
  }
  return { items };
}
/** Hacker News stories naming the searched phrase, posted over the last few hours. */
function hnStories(url: URL) {
  const q = (url.searchParams.get('query') || '').replace(/"/g, '');
  const now = Math.floor(Date.now() / 1000);
  const hits = [1, 2, 3].map(i => ({
    objectID: `${q}-${i}`.replace(/\W+/g, '-'),
    title: `${q} story ${i}`,
    url: `https://example.org/${encodeURIComponent(q)}/${i}`,
    points: 120 / i,
    num_comments: 40 / i,
    created_at_i: now - i * 3600,
  }));
  return { hits, nbHits: hits.length };
}
/** Open Manifold markets whose question names the searched phrase. */
function markets(url: URL) {
  const term = url.searchParams.get('term') || '';
  return [1, 2].map(i => ({
    id: `m-${term}-${i}`.replace(/\W+/g, '-'),
    question: `Will ${term} change by 203${i}?`,
    url: `https://manifold.markets/test/${i}`,
    probability: 0.3 + i / 10,
    uniqueBettorCount: 40 * i,
    volume24Hours: 100 * i,
    closeTime: Date.now() + 365 * DAY,
  }));
}

export async function mockApis(page: Page): Promise<void> {
  await page.route(
    url => !/^(localhost|127\.0\.0\.1)$/.test(new URL(url).hostname),
    async route => {
      const url = new URL(route.request().url());
      const h = url.hostname,
        p = url.pathname;
      if (h.endsWith('wikipedia.org')) {
        const title = url.searchParams.get('titles') || url.searchParams.get('search') || 'Topic';
        return json(
          route,
          url.searchParams.get('action') === 'opensearch' ? [title, [title]] : { query: { pages: { 1: { title } } } },
        );
      }
      if (h === 'wikimedia.org') return json(route, pageviews(url));
      if (h === 'hn.algolia.com')
        return json(route, p.includes('search_by_date') ? { hits: [], nbHits: 0 } : hnStories(url));
      if (h === 'api.manifold.markets') return json(route, markets(url));
      if (p.includes('/wp-json/wp/v2/pages')) return json(route, []);
      if (p.includes('/wp-json/')) return json(route, fixture('reading', 'wp-posts'));
      if (h === 'data-api.ecb.europa.eu')
        return json(route, fixture('ecb', p.includes('/MIR/') ? 'mortgage-rates' : 'deposit-rate'));
      if (h === 'ec.europa.eu')
        return json(route, fixture('eurostat', p.includes('prc_hpi_q') ? 'house-prices' : 'unemployment'));
      if (h === 'api.ipma.pt') return json(route, fixture('ipma', p.includes('warnings') ? 'warnings' : 'fire-risk'));
      if (h.endsWith('open-meteo.com'))
        return json(route, h.startsWith('air-quality') ? {} : fixture('open-meteo', 'forecast-two-places'));
      if (h === 'global-warming.org')
        return json(route, fixture('global-warming', p.includes('co2') ? 'co2' : 'sea-ice'));
      if (h === 'api.github.com') {
        if (p.startsWith('/search/repositories')) return json(route, fixture('github', 'repo-search'));
        if (p.endsWith('/repos')) return json(route, fixture('github', 'user-repos'));
        if (p.includes('/events')) return json(route, []);
        return json(route, fixture('github', 'user'));
      }
      return route.abort(); // fonts and anything unexpected: the page must work without them
    },
  );
}

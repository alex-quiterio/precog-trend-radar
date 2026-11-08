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

/**
 * Guardian articles naming the searched phrase: one a day for the 45 days asked for, and two in the last few
 * hours, newest first (the search's order-by=newest). Generated, so every topic has fresh headlines.
 */
function guardianSearch(url: URL) {
  const q = (url.searchParams.get('q') || '').replace(/"/g, '');
  const now = Date.now();
  const at = (t: number, i: number) => ({
    id: `world/${q}-${i}`.replace(/\W+/g, '-'),
    type: 'article',
    sectionId: 'world',
    sectionName: 'World news',
    webPublicationDate: new Date(t).toISOString().replace(/\.\d+Z$/, 'Z'),
    webTitle: i === 0 ? `Guardian: what's new on ${q}` : `${q}: report ${i}`,
    webUrl: `https://www.theguardian.com/world/${encodeURIComponent(q)}/${i}`,
    apiUrl: '',
    isHosted: false,
  });
  const results = [at(now - 2 * 3600e3, 0), at(now - 5 * 3600e3, 1)];
  for (let d = 1; d < 45; d++) results.push(at(now - d * DAY, d + 1));
  return { response: { status: 'ok', total: results.length, pages: 1, currentPage: 1, results } };
}

/**
 * Answers every outside request. With `echoes`, World's daily pick gets the saved replies of 6 Nov 2026
 * (Wikipedia's feed, Wikidata, Hacker News's front page, Manifold's busiest markets); without, Wikipedia's
 * feed is missing, so World keeps its shipped topics and the other tests can rely on them.
 */
export async function mockApis(page: Page, { echoes = false, guardian = false } = {}): Promise<void> {
  // With `guardian`, a key is set before the app starts, so the trend fetch reads the Guardian below.
  if (guardian) await page.addInitScript(() => localStorage.setItem('precog.guardian.key', JSON.stringify('test-key')));
  await page.route(
    url => !/^(localhost|127\.0\.0\.1)$/.test(new URL(url).hostname),
    async route => {
      const url = new URL(route.request().url());
      const h = url.hostname,
        p = url.pathname;
      if (p.includes('/api/rest_v1/feed/featured/'))
        return echoes ? json(route, fixture('echoes', 'featured-feed')) : route.fulfill({ status: 404 });
      if (h === 'query.wikidata.org') return json(route, fixture('echoes', 'wikidata-humans'));
      if (h === 'hn.algolia.com' && url.searchParams.get('tags') === 'front_page')
        return json(route, echoes ? fixture('echoes', 'hn-front-page') : { hits: [] });
      if (h === 'api.manifold.markets' && url.searchParams.get('sort') === '24-hour-vol')
        return json(route, echoes ? fixture('echoes', 'manifold-trending') : []);
      if (h.endsWith('wikipedia.org') && p.includes('/api/rest_v1/page/summary/')) {
        // Any article: the saved summary, retitled, so each topic gets one line about itself.
        const title = decodeURIComponent(p.split('/').pop() || 'Topic').replace(/_/g, ' ');
        return json(route, {
          ...(fixture('wikipedia', 'summary') as object),
          title,
          description: `About ${title}`,
          extract: `${title} is a subject PRECOG tracks. It has a second sentence.`,
          content_urls: { desktop: { page: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}` } },
        });
      }
      if (h === 'precoscombustiveis.dgeg.gov.pt') return json(route, fixture('dgeg', 'pmd'));
      if (h === 'api.coingecko.com')
        return json(route, fixture('coingecko', p.endsWith('/global') ? 'global' : 'coin-markets'));
      if (h === 'api.alternative.me') return json(route, fixture('feargreed', 'fng'));
      if (h === 'api.eia.gov') return json(route, fixture('eia', 'spot'));
      if (h === 'data-api.ecb.europa.eu' && p.includes('/EXR/')) return json(route, fixture('ecb', 'fx-rates'));
      if (h === 'data-api.ecb.europa.eu' && p.includes('/YC/')) return json(route, fixture('ecb', 'bond-yield'));
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
      if (h === 'content.guardianapis.com')
        return json(
          route,
          p === '/search' ? guardianSearch(url) : { response: { status: 'ok', editorsPicks: [], mostViewed: [] } },
        );
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
      // Every radar answers with the saved Lisbon day; iNaturalist with its saved species counts.
      if (h === 'aloftdata.s3-eu-west-1.amazonaws.com')
        return route.fulfill({
          status: 200,
          contentType: 'text/csv',
          body: readFileSync(
            fileURLToPath(new URL('../src/sources/aloft/fixtures/ptlis-vpts.csv', import.meta.url)),
            'utf8',
          ),
        });
      if (h === 'api.energyzero.nl') return json(route, fixture('powerprices', 'energyzero'));
      if (h === 'apidatos.ree.es') return json(route, fixture('powerprices', 'ree-spot'));
      if (h === 'api.worldbank.org') return json(route, fixture('worldbank', 'gdp'));
      if (h === 'api.inaturalist.org') return json(route, fixture('inaturalist', 'species-counts'));
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

// PRECOG / Trend Radar · Channels: each one is a whole dashboard for one context.
// A channel names its lens (the topics whose attention it charts), the datapoints worth knowing in
// that context, the streams it shows, and any special views (GitHub). Switching channel switches all of it.
import type { AppStore } from '@/state';
import { AMSTERDAM_SITES, NEWS_SITES, PORTUGAL_SITES, TURNING_SITES } from '@sources/reading';

export interface StorySources {
  /** Sites (origins) whose posts can be a topic's story when they name it in the title. */
  sites: string[];
  /** How many days a post stays a fresh story (2 by default; a site that posts weekly needs longer). */
  days?: number;
  /** The newest headlines from these sites, listed under the topics' stories whatever they name. */
  latest?: { title: string; sites: string[] };
}

export interface Channel {
  id: string;
  /** Short label for the channel bar. */
  label: string;
  /** Icon in the channel bar (see components/ChannelIcon.vue). */
  icon: string;
  /** One line under the channel name. */
  kicker: string;
  lensId: string;
  /** Datapoint card ids (see features/datapoints.ts), in display order. */
  datapoints: string[];
  /** Stream tabs, in order, by id (see src/sources/<name>/stream.ts). */
  streams: string[];
  /** Followed sites to read in this channel (origins); empty means all of them. */
  sites?: string[];
  /** Opens with Today's stories: what is happening with each topic, in a sentence (components/DigestPanel.vue). */
  digest?: boolean;
  /**
   * Where its Today's stories come from. Left out, they're the world's: Wikipedia's "In the news" and the
   * Guardian. Set, only these sites tell them, so a channel's stories stay in its own place or voice.
   */
  stories?: StorySources;
  /** Shows Plots: land you're watching, compared side by side (PlotsPanel.vue). */
  plots?: boolean;
  /** Opens with the flyway: bird migration on the weather radars from Denmark to Lisbon (MigrationPanel.vue). */
  migration?: boolean;
  /** Opens with real prices (components/MarketsPanel.vue) and charts no attention: no Signal, gist or radar. */
  prices?: boolean;
  /** Links out shown under the channel's name (places with no API the page could read). */
  links?: { label: string; href: string }[];
  /** Extra views: the GitHub topic and personal panels. */
  github?: boolean;
  /** A channel you made yourself (from the "+" in the channel bar): only these can be deleted. */
  own?: boolean;
  /** Keeps to its own topics: the gist never mentions what is hot in other channels. */
  focused?: boolean;
  /** A country channel. It never shows another country's data or topics, not even in "Elsewhere". */
  country?: 'pt' | 'nl';
}

/** A channel's open-data cards. Country channels only ever show their own country's data. */
export const channelDatapoints = (c: Channel): string[] => c.datapoints;

const MARGINALIAN = 'https://www.themarginalian.org';
const DUTCHNEWS = NEWS_SITES[0].url;
const site = (sites: { url: string; name: string }[], name: string) => sites.find(s => s.name === name)!.url;
const TGS = site(TURNING_SITES, 'The Great Simplification');
const TURNING = TURNING_SITES.map(s => s.url);
// A kept library is undated, so it can't tell a day's story: only the dated sites do.
const TURNING_DATED = TURNING_SITES.filter(s => !s.library).map(s => s.url);

export const CHANNELS: Channel[] = [
  {
    id: 'world',
    icon: 'globe',
    label: 'World',
    kicker: 'What the internet is echoing today, what forecasters expect, and the money underneath.',
    lensId: 'world',
    datapoints: ['inflation-ea', 'ecb', 'unemployment-ea', 'co2'],
    streams: ['news', 'forecasts', 'hn', 'reading'],
    digest: true,
  },
  {
    id: 'turning',
    icon: 'leaf',
    label: 'Great Turning',
    kicker:
      'The shift to a life-sustaining world: the energy and ecology underneath, the local economies being built, and the stories that carry us.',
    lensId: 'turning',
    datapoints: ['co2', 'seaice'],
    streams: ['reading', 'news', 'forecasts'],
    sites: TURNING,
    digest: true,
    // Its own voices only. They publish weekly or less, so a story stays fresh for a month.
    stories: { sites: TURNING_DATED, days: 30, latest: { title: 'New in The Great Turning', sites: TURNING_DATED } },
  },
  {
    id: 'marginalian',
    icon: 'book',
    label: 'Marginalian',
    kicker: 'Art, science, poetry and philosophy, matched to what you’re watching.',
    lensId: 'marginalian',
    datapoints: [],
    streams: ['reading'],
    sites: [MARGINALIAN],
    digest: true,
    // Its own essays only. It posts a few times a week, so a story stays fresh for a month.
    stories: { sites: [MARGINALIAN], days: 30, latest: { title: 'New on The Marginalian', sites: [MARGINALIAN] } },
  },
  {
    id: 'energy',
    icon: 'bolt',
    label: 'Energy & power',
    kicker: 'What powers the grid, what it costs at home, and today’s sun and wind.',
    lensId: 'energy',
    // When power is cheap first: the one thing here you can act on today.
    datapoints: [
      'power-pt',
      'power-nl',
      'renew-pt',
      'energyinfl-pt',
      'diesel-pt',
      'petrol-pt',
      'sun-lisbon',
      'renew-nl',
      'energyinfl-nl',
      'sun-amsterdam',
      'energyinfl-ea',
      'co2',
    ],
    streams: ['news', 'forecasts', 'reading', 'hn'],
    sites: [TGS],
  },
  {
    id: 'portugal',
    icon: 'land',
    label: 'Portugal & land',
    kicker: 'Fire, water and soil in the interior, and the practices of a rural, closed-loop life.',
    lensId: 'portugal',
    datapoints: [
      'fire',
      'warnings',
      'soil-mafra',
      'wx-lisbon',
      'air-lisbon',
      'wx-porto',
      'air-porto',
      'treeloss-pt',
      'forest-pt',
      'nitrate-pt',
      'diesel-pt',
      'petrol-pt',
      'inflation-pt',
      'unemployment-pt',
    ],
    streams: ['news', 'reading', 'forecasts'],
    sites: PORTUGAL_SITES.map(s => s.url),
    digest: true,
    plots: true,
    // Portuguese sources only, matched in Portuguese.
    stories: {
      sites: PORTUGAL_SITES.map(s => s.url),
      latest: { title: 'Today on the land in Portugal', sites: PORTUGAL_SITES.map(s => s.url) },
    },
    country: 'pt',
  },
  {
    id: 'housing',
    icon: 'house',
    label: 'Housing',
    kicker: 'House prices, rents and mortgage rates, Portugal and the Netherlands side by side.',
    lensId: 'housing',
    datapoints: [
      'hpi-pt',
      'rent-pt',
      'mortgage-pt',
      'hpi-nl',
      'rent-nl',
      'mortgage-nl',
      'hpi-ea',
      'rent-ea',
      'mortgage-ea',
      'ecb',
    ],
    streams: ['news', 'reading', 'forecasts', 'hn'],
  },
  {
    id: 'circular',
    icon: 'cycle',
    label: 'Circular economy',
    kicker: 'The rules and markets that shape recycling and waste services.',
    lensId: 'circular',
    datapoints: ['inflation-ea', 'ecb', 'unemployment-ea'],
    streams: ['news', 'reading', 'hn', 'forecasts'],
  },
  {
    id: 'amsterdam',
    icon: 'bike',
    label: 'Alt Amsterdam',
    kicker: 'The cooperative, regenerative city: what is moving in its scene, picked each day.',
    lensId: 'amsterdam',
    datapoints: [
      'hpi-nl',
      'rent-nl',
      'mortgage-nl',
      'renew-nl',
      'energyinfl-nl',
      'soil-amsterdam',
      'wx-amsterdam',
      'air-amsterdam',
      'no2-amsterdam',
      'ghg-nl',
      'waste-nl',
      'circular-nl',
      'inflation-nl',
      'unemployment-nl',
    ],
    streams: ['reading', 'news', 'forecasts'],
    sites: AMSTERDAM_SITES.map(s => s.url),
    digest: true,
    // Dutch news, and the scene sites rooted in Amsterdam (Shareable and Resilience are international).
    stories: {
      sites: [DUTCHNEWS, site(AMSTERDAM_SITES, 'Commons Network'), site(AMSTERDAM_SITES, 'Repair Café')],
      latest: { title: 'Today in the Netherlands', sites: [DUTCHNEWS] },
    },
    links: [
      { label: 'Gatherings this weekend on Hipsy', href: 'https://hipsy.nl/events?period=current_weekend' },
      { label: 'Workshops', href: 'https://hipsy.nl/events/workshops' },
    ],
    country: 'nl',
  },
  {
    id: 'markets',
    icon: 'candles',
    label: 'Markets',
    kicker: 'Real prices: oil, US stocks and AI leaders, crypto, gold and currencies, and what moved this week.',
    lensId: 'markets',
    datapoints: ['yield-ea-10y', 'ecb', 'inflation-ea', 'unemployment-ea'],
    streams: ['news', 'forecasts', 'hn'],
    prices: true,
    digest: true,
  },
  {
    id: 'birds',
    icon: 'bird',
    label: 'Bird migration',
    kicker:
      'The flyway from the North Sea to the Algarve on the weather radars, and the birds just seen near Amsterdam and Lisbon.',
    lensId: 'birds',
    migration: true,
    // Birds crossing near each city, and its weather: wind and rain decide a migration night.
    datapoints: ['birds-amsterdam', 'wx-amsterdam', 'birds-lisbon', 'wx-lisbon'],
    // Birds only: no followed sites (they write about other things), and the gist never looks elsewhere.
    streams: ['seen-amsterdam', 'seen-lisbon', 'news'],
    focused: true,
    digest: true,
    links: [
      { label: 'Trektellen: live counts at watch sites', href: 'https://www.trektellen.org/' },
      { label: 'eBird: North Holland', href: 'https://ebird.org/region/NL-NH' },
      { label: 'eBird: Lisbon', href: 'https://ebird.org/region/PT-11' },
      { label: 'Migration atlas', href: 'https://migrationatlas.org/' },
    ],
  },
  {
    id: 'github',
    icon: 'code',
    label: 'GitHub',
    kicker: 'What’s being built, what’s rising, and your own work.',
    lensId: 'github',
    datapoints: [],
    streams: ['news', 'hn'],
    github: true,
  },
];

/** Channels for every lens: the shipped ones, then a plain channel for each lens you made yourself. */
export function channels(app: AppStore): Channel[] {
  const own = app.state.lenses
    .filter(l => !CHANNELS.some(c => c.lensId === l.id))
    .map(l => ({
      id: l.id,
      icon: 'star',
      label: l.name,
      kicker: l.desc || 'Your own lens.',
      lensId: l.id,
      datapoints: [],
      streams: ['reading', 'forecasts', 'hn'],
      own: true,
    }));
  return [...CHANNELS.filter(c => app.lensById(c.lensId)), ...own];
}
/** True for a lens PRECOG ships with (its channel can't be deleted). */
export const isBuiltInLens = (lensId: string): boolean => CHANNELS.some(c => c.lensId === lensId);
/** The channel showing a lens (undefined for none). */
export const channelOfLens = (app: AppStore, lensId: string): Channel | undefined =>
  channels(app).find(c => c.lensId === lensId);
/** The channel on screen: the one whose lens is active. */
export function activeChannel(app: AppStore): Channel {
  const all = channels(app);
  return all.find(c => c.lensId === app.state.activeLens) || all[0];
}

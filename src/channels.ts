// PRECOG / Trend Radar · Channels: each one is a whole dashboard for one context.
// A channel names its lens (the topics whose attention it charts), the datapoints worth knowing in
// that context, the streams it shows, and any special views (GitHub). Switching channel switches all of it.
import type { AppStore } from '@/state';

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
  /** Extra views: the GitHub topic and personal panels. */
  github?: boolean;
  /** A channel you made yourself (from the "+" in the channel bar): only these can be deleted. */
  own?: boolean;
  /** A country channel. It never shows another country's data or topics, not even in "Elsewhere". */
  country?: 'pt' | 'nl';
}

/** A channel's open-data cards. Country channels only ever show their own country's data. */
export const channelDatapoints = (c: Channel): string[] => c.datapoints;

const TGS = 'https://www.thegreatsimplification.com';
const MARGINALIAN = 'https://www.themarginalian.org';

export const CHANNELS: Channel[] = [
  {
    id: 'world',
    icon: 'globe',
    label: 'World',
    kicker: 'What the internet is echoing today, what forecasters expect, and the money underneath.',
    lensId: 'world',
    datapoints: ['inflation-ea', 'ecb', 'unemployment-ea', 'co2'],
    streams: ['news', 'forecasts', 'reading', 'hn'],
  },
  {
    id: 'tgs',
    icon: 'leaf',
    label: 'Great Simplification',
    kicker: 'Energy, ecology and the economy as one system, with the planet’s slow numbers.',
    lensId: 'tgs',
    datapoints: ['co2', 'seaice'],
    streams: ['reading', 'news', 'forecasts'],
    sites: [TGS],
  },
  {
    id: 'energy',
    icon: 'bolt',
    label: 'Energy & power',
    kicker: 'What powers the grid, what it costs at home, and today’s sun and wind.',
    lensId: 'energy',
    datapoints: [
      'renew-pt',
      'energyinfl-pt',
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
    datapoints: ['fire', 'warnings', 'soil-mafra', 'wx-lisbon', 'wx-porto', 'inflation-pt', 'unemployment-pt'],
    streams: ['news', 'reading', 'forecasts'],
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
    kicker: 'The cooperative, regenerative city.',
    lensId: 'amsterdam',
    datapoints: ['soil-amsterdam', 'wx-amsterdam', 'inflation-nl', 'unemployment-nl'],
    streams: ['news', 'reading', 'hn'],
    sites: [MARGINALIAN, TGS],
    country: 'nl',
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

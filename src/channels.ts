// PRECOG / Trend Radar · Channels: each one is a whole dashboard for one context.
// A channel names its lens (the topics whose attention it charts), the datapoints worth knowing in
// that context, the streams it shows, and any special views (GitHub). Switching channel switches all of it.
import type { StorySrc } from './features/stories';
import { lensById, state } from './state';

export interface Channel {
  id: string;
  /** Short label for the channel bar. */
  label: string;
  /** One line under the channel name. */
  kicker: string;
  lensId: string;
  /** Datapoint card ids (see features/datapoints.ts), in display order. */
  datapoints: string[];
  /** Stream tabs, in order. */
  streams: StorySrc[];
  /** Followed sites to read in this channel (origins); empty means all of them. */
  sites?: string[];
  /** Extra views: the GitHub topic and personal panels. */
  github?: boolean;
}

const TGS = 'https://www.thegreatsimplification.com';
const MARGINALIAN = 'https://www.themarginalian.org';

export const CHANNELS: Channel[] = [
  {
    id: 'world',
    label: 'World',
    kicker: 'The big stories, what forecasters expect, and the money underneath.',
    lensId: 'world',
    datapoints: ['inflation', 'ecb', 'unemployment', 'co2'],
    streams: ['forecasts', 'reading', 'hn'],
  },
  {
    id: 'tgs',
    label: 'Great Simplification',
    kicker: 'Energy, ecology and the economy as one system, with the planet’s slow numbers.',
    lensId: 'tgs',
    datapoints: ['co2', 'seaice', 'soil'],
    streams: ['reading', 'forecasts'],
    sites: [TGS],
  },
  {
    id: 'portugal',
    label: 'Portugal & land',
    kicker: 'Fire, water and soil in the interior, and the practices of a rural, closed-loop life.',
    lensId: 'portugal',
    datapoints: ['fire', 'warnings', 'soil-mafra', 'soil', 'wx-lisbon', 'wx-porto', 'inflation'],
    streams: ['reading', 'forecasts'],
  },
  {
    id: 'circular',
    label: 'Circular economy',
    kicker: 'The rules and markets that shape recycling and waste services.',
    lensId: 'circular',
    datapoints: ['inflation', 'ecb', 'unemployment'],
    streams: ['reading', 'hn', 'forecasts'],
  },
  {
    id: 'amsterdam',
    label: 'Alt Amsterdam',
    kicker: 'The cooperative, regenerative city.',
    lensId: 'amsterdam',
    datapoints: ['soil-amsterdam', 'wx-amsterdam', 'inflation', 'unemployment'],
    streams: ['reading', 'hn'],
    sites: [MARGINALIAN, TGS],
  },
  {
    id: 'github',
    label: 'GitHub',
    kicker: 'What’s being built, what’s rising, and your own work.',
    lensId: 'github',
    datapoints: [],
    streams: ['hn'],
    github: true,
  },
];

/** Channels for every lens: the shipped ones, then a plain channel for each lens you made yourself. */
export function channels(): Channel[] {
  const own = state.lenses
    .filter(l => !CHANNELS.some(c => c.lensId === l.id))
    .map(l => ({
      id: l.id,
      label: l.name,
      kicker: l.desc || 'Your own lens.',
      lensId: l.id,
      datapoints: [],
      streams: ['reading', 'forecasts', 'hn'] as StorySrc[],
    }));
  return [...CHANNELS.filter(c => lensById(c.lensId)), ...own];
}
/** The channel on screen: the one whose lens is active. */
export function activeChannel(): Channel {
  const all = channels();
  return all.find(c => c.lensId === state.activeLens) || all[0];
}

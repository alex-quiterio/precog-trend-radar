// PRECOG / Trend Radar · iNaturalist: which birds people recorded around a city, this week and the week before.
// Keyless and browser-readable (about 60 requests a minute allowed); each place is asked twice an hour at most.
import { DAY, MIN } from '@core/config';
import { getJSON } from '@sources/registry';
import { parseSpeciesCounts, type SpeciesCount } from './parse';
export * from './parse';

/** A circle around a city: where its sightings count. */
export interface Place {
  name: string;
  lat: number;
  lng: number;
  /** km */
  radius: number;
}
/** The birds the Bird migration channel watches (iNaturalist taxon ids): pinned whenever someone records them. */
export const WATCHED: Record<number, string> = {
  4733: 'White stork',
  3947: 'Black-tailed godwit',
  3731: 'Eurasian spoonbill',
  41: 'Common crane',
  14850: 'Common starling',
  14849: 'Spotless starling',
  11901: 'Barn swallow',
  6638: 'Common swift',
  73222: 'Greater flamingo',
  7101: 'Barnacle goose',
};
export interface Sightings {
  /** Watched birds recorded in the last 7 days, most recorded first (they may be too few to make the top 40). */
  mine: SpeciesCount[];
  /** Species seen in the last 7 days, most recorded first. */
  week: SpeciesCount[];
  /** Ids of species seen in the 7 days before that: anything else this week is new. */
  before: Set<number>;
}

const cache = new Map<string, { at: number; s: Sightings }>();
const day = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Birds (taxon 3) recorded around a place, this week against last week. */
export async function birdSightings(p: Place, signal: AbortSignal, now = Date.now()): Promise<Sightings> {
  const hit = cache.get(p.name);
  if (hit && now - hit.at < 30 * MIN) return hit.s;
  const url = (taxa: string, d1: number, d2: number, n: number) =>
    `https://api.inaturalist.org/v1/observations/species_counts?taxon_id=${taxa}&lat=${p.lat}&lng=${p.lng}&radius=${p.radius}` +
    `&d1=${day(d1)}&d2=${day(d2)}&per_page=${n}&locale=en`;
  const [week, before, mine] = await Promise.all([
    getJSON(url('3', now - 6 * DAY, now, 40), signal).then(parseSpeciesCounts),
    getJSON(url('3', now - 13 * DAY, now - 7 * DAY, 200), signal).then(parseSpeciesCounts),
    getJSON(url(Object.keys(WATCHED).join(','), now - 6 * DAY, now, 20), signal).then(parseSpeciesCounts),
  ]);
  const s = { week, before: new Set(before.map(b => b.id)), mine };
  cache.set(p.name, { at: now, s });
  return s;
}

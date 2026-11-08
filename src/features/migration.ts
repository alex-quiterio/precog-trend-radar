// PRECOG / Trend Radar · The flyway: a helicopter view of bird migration on the East Atlantic flyway, the route
// that links the Netherlands and Portugal. The weather radars along it that publish bird data, north to south:
// how many birds crossed each one on its latest night, which way they headed, and a few plain sentences on the
// flow towards the Netherlands and towards Portugal. Loads while the Bird migration channel is on screen.
import { reactive } from 'vue';
import { errorText, isAbort } from '@core/errors';
import { nf0 } from '@core/format';
import { type RadarDays, compass, latestDay } from '@sources/aloft';
import { pool } from '@sources/registry';

export interface Station {
  radar: string;
  /** Where it stands, e.g. "Herwijnen". */
  site: string;
  /** Where it is, in a few words, e.g. "Netherlands" or "Germany, in the North Sea". */
  where: string;
  /** The country whose flow it counts towards. */
  to: 'nl' | 'pt';
  /** For the radars nearest the cities PRECOG watches. */
  near?: string;
  tz: string;
}

/**
 * North to south, the way birds fly in autumn. Only radars whose bird profiles are usable: the French, Spanish and
 * most German radars publish profiles with every height flagged as too sparse, so the route has a gap between.
 */
export const FLYWAY: Station[] = [
  { radar: 'deasb', site: 'Borkum', where: 'Germany, in the North Sea', to: 'nl', tz: 'Europe/Berlin' },
  { radar: 'nldhl', site: 'Den Helder', where: 'Netherlands', to: 'nl', tz: 'Europe/Amsterdam' },
  { radar: 'nlhrw', site: 'Herwijnen', where: 'Netherlands', to: 'nl', near: 'Amsterdam', tz: 'Europe/Amsterdam' },
  { radar: 'ptprt', site: 'Porto', where: 'Portugal', to: 'pt', tz: 'Europe/Lisbon' },
  { radar: 'ptlis', site: 'Coruche', where: 'Portugal', to: 'pt', near: 'Lisbon', tz: 'Europe/Lisbon' },
  { radar: 'ptfar', site: 'Loulé', where: 'Portugal, the Algarve', to: 'pt', tz: 'Europe/Lisbon' },
];
/** What lies between the Dutch and Portuguese radars. */
export const GAP = 'France and Spain: about 1,500 km of route whose radars publish no usable bird data.';

export interface StationRead extends Station {
  data?: RadarDays;
  error?: string;
}

const fmtBirds = (n: number) => nf0.format(n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n / 10) * 10);
/** "4,200 per km", rounded so it doesn't pretend to more precision than a radar has. */
export const perKm = (n: number) => `${fmtBirds(n)} per km`;

export type Season = 'spring' | 'autumn' | 'winter';
/** The migration season of a day ("2026-11-06"): spring March–June, autumn July–November, else winter. */
export function seasonOf(day: string): Season {
  const m = Number(day.slice(5, 7));
  return m >= 3 && m <= 6 ? 'spring' : m >= 7 && m <= 11 ? 'autumn' : 'winter';
}
const SEASON_LINE: Record<Season, string> = {
  autumn: 'Autumn passage: birds head south and south-west, towards Iberia and Africa.',
  spring: 'Spring passage: birds head north and north-east, back to their breeding grounds.',
  winter: 'Winter: little long-distance migration; a cold snap up north can send birds south-west.',
};

/** Facts in a few sentences: the season, the flow into each country along the way, the busiest radar. */
export function flywayNotes(stations: StationRead[]): string[] {
  const ok = stations.filter((s): s is StationRead & { data: RadarDays } => !!s.data && s.data.day.birdsPerKm > 0);
  if (!ok.length) return [];
  const season = seasonOf(ok[0].data.day.day);
  const notes: string[] = [];
  const heads = ok.map(s => s.data.day.heading).filter((h): h is number => h != null);
  const southward = heads.filter(h => h > 90 && h < 270).length;
  const fits = season === 'spring' ? heads.length - southward : southward;
  notes.push(
    SEASON_LINE[season] +
      (heads.length
        ? ` ${fits} of ${heads.length} radars see birds heading ${season === 'spring' ? 'north' : 'south'}.`
        : ''),
  );
  // The way birds travel: north to south, or south to north in spring.
  const route = season === 'spring' ? [...ok].reverse() : ok;
  const into = (to: 'nl' | 'pt', country: string) => {
    const leg = route.filter(s => s.to === to);
    const city = leg.find(s => s.near);
    if (!city) return;
    const upstream = leg.slice(0, leg.indexOf(city));
    const head = city.data.day.heading != null ? `, heading ${compass(city.data.day.heading)}` : '';
    const before = upstream.map(s => `${perKm(s.data.day.birdsPerKm)} over ${s.site}`).join(', ');
    notes.push(
      `Towards ${country}: ${before ? `${before}, then ` : ''}` +
        `${perKm(city.data.day.birdsPerKm)} over ${city.site}, near ${city.near}${head}.`,
    );
  };
  if (season === 'spring') {
    into('pt', 'Portugal');
    into('nl', 'the Netherlands');
  } else {
    into('nl', 'the Netherlands');
    into('pt', 'Portugal');
  }
  const top = ok.reduce((a, s) => (s.data.day.birdsPerKm > a.data.day.birdsPerKm ? s : a), ok[0]);
  notes.push(`Busiest: ${top.site} (${top.where}), ${perKm(top.data.day.birdsPerKm)}.`);
  return notes;
}

/** Compared with the night before, as a word, or '' when there is no night before or it barely moved. */
export function versus(d: RadarDays): { text: string; dir: 'up' | 'down' | '' } {
  const a = d.day.birdsPerKm,
    b = d.prev?.birdsPerKm;
  if (b == null || b <= 0 || a <= 0) return { text: '', dir: '' };
  const r = a / b;
  if (r >= 1.9) return { text: `${nf0.format(r)}× the night before`, dir: 'up' };
  if (r >= 1.2) return { text: `+${nf0.format((r - 1) * 100)}% on the night before`, dir: 'up' };
  if (r <= 0.55) return { text: `${nf0.format((1 - r) * 100)}% fewer than the night before`, dir: 'down' };
  if (r <= 0.85) return { text: `−${nf0.format((1 - r) * 100)}% on the night before`, dir: 'down' };
  return { text: 'about the same as the night before', dir: '' };
}

/** The flyway's store: one read per radar, side by side, each failing on its own. */
export function createMigration(stations: Station[] = FLYWAY) {
  const state = reactive({
    stations: stations.map(s => ({ ...s })) as StationRead[],
    loading: false,
    at: 0,
  });
  let ctl: AbortController | null = null;
  async function load(): Promise<void> {
    ctl?.abort();
    const c = (ctl = new AbortController());
    state.loading = true;
    // Two at a time: each file is large, and the panel fills in as they come.
    await pool(state.stations, 2, async s => {
      try {
        s.data = await latestDay(s.radar, c.signal);
        s.error = undefined;
      } catch (e) {
        if (!isAbort(e)) s.error = errorText(e);
      }
    });
    if (c.signal.aborted) return;
    state.loading = false;
    state.at = Date.now();
  }
  const stop = () => ctl?.abort();
  return { state, load, stop };
}

// PRECOG / Trend Radar · The world's largest economies, for the Markets channel: GDP in current US dollars from
// the World Bank (keyless, browser-readable), the top seven by the latest year, each with its change over five
// years, and the Netherlands and Portugal on the same scale. Beside each, its World Happiness Report score (via
// Our World in Data, keyless). Annual data, so one call each a day at most.
import { reactive } from 'vue';
import { HOUR } from '@core/config';
import { errorText } from '@core/errors';
import { store } from '@core/storage';
import { getJSON } from '@sources/registry';
import { parseIndicator, type YearlyByCountry } from '@sources/worldbank/parse';
import { type Happiness, parseHappiness } from '@sources/owid/parse';
import { withTimeout, HttpError } from '@sources/registry';

/** The economies that could make a top seven, with short names (the World Bank's are "Korea, Rep." and so on). */
export const CANDIDATES: Record<string, string> = {
  USA: 'United States',
  CHN: 'China',
  DEU: 'Germany',
  JPN: 'Japan',
  IND: 'India',
  GBR: 'United Kingdom',
  FRA: 'France',
  ITA: 'Italy',
  RUS: 'Russia',
  CAN: 'Canada',
  BRA: 'Brazil',
  ESP: 'Spain',
  KOR: 'South Korea',
  MEX: 'Mexico',
  AUS: 'Australia',
  IDN: 'Indonesia',
};

/** Home: shown under the top seven, on the same scale, whatever their rank. */
export const HOME: Record<string, string> = { NLD: 'Netherlands', PRT: 'Portugal' };

export interface Economy {
  iso: string;
  name: string;
  year: number;
  /** US dollars. */
  value: number;
  /** % change against five years before (null without that year). */
  change5: number | null;
}

/** One country's latest year and its change over five years. */
function economy(iso: string, name: string, s: { year: number; value: number }[]): Economy {
  const last = s[s.length - 1],
    then = s.find(p => p.year === last.year - 5);
  return {
    iso,
    name,
    year: last.year,
    value: last.value,
    change5: then ? (last.value / then.value - 1) * 100 : null,
  };
}

/** The top `n` by each country's latest year, biggest first. */
export function topEconomies(data: YearlyByCountry, n = 7): Economy[] {
  return Object.entries(data)
    .filter(([iso, s]) => CANDIDATES[iso] && s.length)
    .map(([iso, s]) => economy(iso, CANDIDATES[iso], s))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

/** The Netherlands and Portugal, in that order (those with data). */
export const homeEconomies = (data: YearlyByCountry): Economy[] =>
  Object.entries(HOME).flatMap(([iso, name]) => (data[iso]?.length ? [economy(iso, name, data[iso])] : []));

/** A row for a country that may have no GDP figure (a happiest country the World Bank doesn't cover). */
export type Row = Omit<Economy, 'value' | 'year'> & { value: number | null; year: number | null };

/** The `n` happiest countries, happiest first, with their GDP when known. */
export function happiestEconomies(data: YearlyByCountry, happy: Record<string, Happiness>, n = 3): Row[] {
  return Object.entries(happy)
    .sort((a, b) => a[1].rank - b[1].rank)
    .slice(0, n)
    .map(([iso, h]) => {
      const name = h.name || CANDIDATES[iso] || HOME[iso] || iso; // a cache from before names were kept
      return data[iso]?.length ? economy(iso, name, data[iso]) : { iso, name, year: null, value: null, change5: null };
    });
}

/** "$30.8T", "$950B". */
export const usd = (v: number): string =>
  v >= 1e12 ? `$${(v / 1e12).toFixed(v >= 1e13 ? 1 : 2)}T` : `$${Math.round(v / 1e9)}B`;

const KEY = 'precog.gdp.v2'; // v2 adds the Netherlands and Portugal
const HAPPY_KEY = 'precog.happy.v2'; // v2 keeps each country's name
const HAPPY_URL =
  'https://ourworldindata.org/grapher/happiness-cantril-ladder.csv?v=1&csvType=full&useColumnShortNames=true';
type HappyByCountry = Record<string, Happiness>;

/** Every country's latest happiness score and rank (57 KB of CSV), kept for the day. */
async function loadHappiness(): Promise<HappyByCountry> {
  const hit = store.get<{ at: number; data: HappyByCountry } | null>(HAPPY_KEY, null);
  if (hit && Date.now() - hit.at < 24 * HOUR) return hit.data;
  try {
    const r = await fetch(HAPPY_URL, { signal: withTimeout(undefined) });
    if (!r.ok) throw new HttpError(r.status);
    const data = parseHappiness(await r.text());
    store.set(HAPPY_KEY, { at: Date.now(), data });
    return data;
  } catch (e) {
    if (hit) return hit.data; // a year-old survey beats none
    throw e;
  }
}

export function createGdp() {
  const state = reactive({
    data: null as YearlyByCountry | null,
    happy: null as HappyByCountry | null,
    error: '',
    loading: false,
    at: 0,
  });
  /** GDP for the happiest countries, which usually aren't among the ones asked for (Finland, Denmark…). */
  async function loadHappiestGdp(h: HappyByCountry): Promise<void> {
    const want = Object.entries(h)
      .sort((a, b) => a[1].rank - b[1].rank)
      .slice(0, 3)
      .map(([iso]) => iso)
      .filter(iso => /^[A-Z]{3}$/.test(iso));
    const have = state.data ?? {};
    const missing = want.filter(iso => !have[iso]);
    if (!missing.length) return;
    const key = `precog.gdp.extra.v1.${missing.join(';')}`;
    const hit = store.get<{ at: number; data: YearlyByCountry } | null>(key, null);
    let extra = hit && Date.now() - hit.at < 24 * HOUR ? hit.data : null;
    if (!extra) {
      const year = new Date().getUTCFullYear();
      extra = parseIndicator(
        await getJSON(
          `https://api.worldbank.org/v2/country/${missing.join(';')}/indicator/NY.GDP.MKTP.CD` +
            `?format=json&date=${year - 11}:${year}&per_page=200`,
        ),
      );
      store.set(key, { at: Date.now(), data: extra });
    }
    state.data = { ...(state.data ?? {}), ...extra };
  }
  /** Happiness loads on its own: if it fails, GDP still shows, without the column or the happiest. */
  const loadHappy = async (gdp: Promise<void>) => {
    try {
      const h = await loadHappiness();
      state.happy = h;
      await gdp; // the GDP we already ask for first, so only what's missing is fetched
      await loadHappiestGdp(h);
    } catch {
      /* no happiness, or no GDP for the happiest: the rows show without it */
    }
  };
  async function load(): Promise<void> {
    const gdp = loadGdp();
    void loadHappy(gdp);
    await gdp;
  }
  async function loadGdp(): Promise<void> {
    const hit = store.get<{ at: number; data: YearlyByCountry } | null>(KEY, null);
    if (hit && Date.now() - hit.at < 24 * HOUR) {
      Object.assign(state, { data: hit.data, at: hit.at });
      return;
    }
    state.loading = true;
    try {
      const year = new Date().getUTCFullYear();
      const reply = await getJSON(
        `https://api.worldbank.org/v2/country/${[...Object.keys(CANDIDATES), ...Object.keys(HOME)].join(';')}/indicator/NY.GDP.MKTP.CD` +
          `?format=json&date=${year - 11}:${year}&per_page=500`,
      );
      const data = parseIndicator(reply);
      Object.assign(state, { data, error: '', at: Date.now() });
      store.set(KEY, { at: state.at, data });
    } catch (e) {
      state.error = errorText(e);
      if (hit) state.data = hit.data; // yesterday's numbers beat none: GDP is yearly
    } finally {
      state.loading = false;
    }
  }
  return { state, load };
}

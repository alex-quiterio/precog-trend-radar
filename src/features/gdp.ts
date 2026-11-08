// PRECOG / Trend Radar · The world's largest economies, for the Markets channel: GDP in current US dollars from
// the World Bank (keyless, browser-readable), the top seven by the latest year, each with its change over five
// years. Annual data, so one call a day at most.
import { reactive } from 'vue';
import { HOUR } from '@core/config';
import { errorText } from '@core/errors';
import { store } from '@core/storage';
import { getJSON } from '@sources/registry';
import { parseIndicator, type YearlyByCountry } from '@sources/worldbank/parse';

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

export interface Economy {
  iso: string;
  name: string;
  year: number;
  /** US dollars. */
  value: number;
  /** % change against five years before (null without that year). */
  change5: number | null;
}

/** The top `n` by each country's latest year, biggest first. */
export function topEconomies(data: YearlyByCountry, n = 7): Economy[] {
  return Object.entries(data)
    .filter(([iso, s]) => CANDIDATES[iso] && s.length)
    .map(([iso, s]) => {
      const last = s[s.length - 1],
        then = s.find(p => p.year === last.year - 5);
      return {
        iso,
        name: CANDIDATES[iso],
        year: last.year,
        value: last.value,
        change5: then ? (last.value / then.value - 1) * 100 : null,
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

/** "$30.8T", "$950B". */
export const usd = (v: number): string =>
  v >= 1e12 ? `$${(v / 1e12).toFixed(v >= 1e13 ? 1 : 2)}T` : `$${Math.round(v / 1e9)}B`;

const KEY = 'precog.gdp.v1';
export function createGdp() {
  const state = reactive({ data: null as YearlyByCountry | null, error: '', loading: false, at: 0 });
  async function load(): Promise<void> {
    const hit = store.get<{ at: number; data: YearlyByCountry } | null>(KEY, null);
    if (hit && Date.now() - hit.at < 24 * HOUR) {
      Object.assign(state, { data: hit.data, at: hit.at });
      return;
    }
    state.loading = true;
    try {
      const year = new Date().getUTCFullYear();
      const reply = await getJSON(
        `https://api.worldbank.org/v2/country/${Object.keys(CANDIDATES).join(';')}/indicator/NY.GDP.MKTP.CD` +
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

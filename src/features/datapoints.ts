// PRECOG / Trend Radar · Datapoints panel: ECB, Eurostat, IPMA, Open-Meteo, NOAA CO₂ and NSIDC sea ice.
// Housing (prices, rents, mortgages) and energy (energy prices, renewable share, sun and wind) included.
// Cards sit in groups by place: Portugal, Netherlands, Euro area, Planet. No card mixes two countries.
import { reactive } from 'vue';
import { at, num } from '@sources/shape';
import { nf0, nf1, nf2 } from '@core/format';
import type { SeriesPoint } from '@/types';
import { getJSON } from '@sources/registry';
import { parseEcbLatest, parseEcbSeries } from '@sources/ecb/parse';
import { parseEurostat } from '@sources/eurostat/parse';
import { parseCo2, parseSeaIce } from '@sources/global-warming/parse';
import { parseFireRisk, parseWarnings } from '@sources/ipma/parse';
import { meteoColumn, meteoPlaces, meteoTimes } from '@sources/open-meteo/parse';

export type DatapointGroup = 'pt' | 'nl' | 'ea' | 'planet';
export const DATAPOINT_GROUPS: { id: DatapointGroup; label: string; hint: string }[] = [
  { id: 'pt', label: 'Portugal', hint: 'Land, weather, prices, jobs' },
  { id: 'nl', label: 'Netherlands', hint: 'Land, weather, prices, jobs' },
  { id: 'ea', label: 'Euro area', hint: 'Rates, prices, jobs' },
  { id: 'planet', label: 'Planet', hint: 'The slow numbers' },
];
/** Eurostat area code → card group, id suffix and name. */
const AREAS: [string, DatapointGroup, string, string][] = [
  ['PT', 'pt', 'pt', 'Portugal'],
  ['NL', 'nl', 'nl', 'Netherlands'],
  ['EA21', 'ea', 'ea', 'Euro area'],
];
const month = (t: number) => new Date(t).toISOString().slice(0, 7);
const quarter = (t: number) => `${new Date(t).getUTCFullYear()}-Q${Math.floor(new Date(t).getUTCMonth() / 3) + 1}`;
/** House prices use 'EA' rather than 'EA21'. */
const HPI_AREAS: [string, DatapointGroup, string, string][] = [
  ['PT', 'pt', 'pt', 'Portugal'],
  ['NL', 'nl', 'nl', 'Netherlands'],
  ['EA', 'ea', 'ea', 'Euro area'],
];
export interface DatapointRow {
  /** Stable id a channel picks the card by (see channels.ts). */
  id: string;
  /** Which section of the panel the card sits in. */
  group: DatapointGroup;
  k: string;
  v: string;
  sub?: string;
  src: string;
  href: string;
  o: number;
  /** Optional history for a small chart, oldest first. */
  spark?: SeriesPoint[];
}
export interface DatapointFacts {
  fire?: { hi: number; max: number; n: number };
  warnings?: { red: number; orange: number; yellow: number; types: string };
}
export const dp = reactive({ rows: [] as DatapointRow[], at: 0, facts: {} as DatapointFacts });
export const PLACES: [string, number, number, DatapointGroup][] = [
  ['Lisbon', 38.72, -9.14, 'pt'],
  ['Porto', 41.15, -8.61, 'pt'],
  ['Amsterdam', 52.37, 4.9, 'nl'],
];
// Soil moisture cards: [card id, place, latitude, longitude].
export const SOIL_PLACES: [string, string, number, number, DatapointGroup][] = [
  ['soil-mafra', 'Mafra', 38.94, -9.33, 'pt'],
  ['soil-amsterdam', 'Amsterdam', 52.37, 4.9, 'nl'],
];
export const aqiWord = (v: number | null | undefined): string =>
  v == null
    ? ''
    : v <= 20
      ? 'good'
      : v <= 40
        ? 'fair'
        : v <= 60
          ? 'moderate'
          : v <= 80
            ? 'poor'
            : v <= 100
              ? 'very poor'
              : 'extremely poor';
export async function loadDatapoints(): Promise<void> {
  const rows: DatapointRow[] = [],
    facts: DatapointFacts = {};
  const task = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch {
      /* one source failing never blocks the others */
    }
  };
  await Promise.all([
    task(async () => {
      const j = await getJSON(
        'https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.4F.KR.DFR.LEV?format=jsondata&lastNObservations=1',
      );
      const { value: obs, since } = parseEcbLatest(j);
      rows.push({
        group: 'ea',
        id: 'ecb',
        k: 'ECB deposit rate',
        v: `${nf2.format(obs)}%`,
        src: `ECB Data Portal · since ${since}`,
        href: 'https://data.ecb.europa.eu/',
        o: 1,
      });
    }),
    task(async () => {
      const j = await getJSON(
        'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/une_rt_m?geo=PT&geo=NL&geo=EA21&s_adj=SA&age=TOTAL&sex=T&unit=PC_ACT&lastTimePeriod=13',
      );
      AREAS.forEach(([geo, group, suffix, name]) => {
        const series = parseEurostat(j, { geo });
        const last = series[series.length - 1];
        if (!last) return;
        const yearAgo = series[0];
        rows.push({
          group,
          id: `unemployment-${suffix}`,
          k: `Unemployment · ${name}`,
          v: `${nf1.format(last.value)}%`,
          sub:
            yearAgo && yearAgo !== last
              ? `${last.value - yearAgo.value >= 0 ? '+' : '−'}${nf1.format(Math.abs(last.value - yearAgo.value))} pts in a year`
              : '',
          src: `Eurostat une_rt_m · ${month(last.t)}, seasonally adjusted`,
          href: 'https://ec.europa.eu/eurostat/databrowser/view/une_rt_m/default/table',
          o: 3,
          spark: series,
        });
      });
    }),
    task(async () => {
      // Eurostat's HICP moved to prc_hicp_minr (ECOICOP 2) in 2026; annual rate of change, 13 months.
      const j = await getJSON(
        'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr?geo=PT&geo=NL&geo=EA21&unit=RCH_A&coicop18=TOTAL&lastTimePeriod=13',
      );
      AREAS.forEach(([geo, group, suffix, name]) => {
        const series = parseEurostat(j, { geo });
        const last = series[series.length - 1];
        if (!last) return;
        rows.push({
          group,
          id: `inflation-${suffix}`,
          k: `Inflation · ${name}`,
          v: `${nf1.format(last.value)}%`,
          sub: 'prices vs a year earlier',
          src: `Eurostat HICP · ${month(last.t)}`,
          href: 'https://ec.europa.eu/eurostat/databrowser/view/prc_hicp_minr/default/table',
          o: 2,
          spark: series,
        });
      });
    }),
    task(async () => {
      const j = await getJSON('https://api.ipma.pt/open-data/forecast/meteorology/rcm/rcm-d0.json');
      const { levels: lv, day } = parseFireRisk(j);
      const hi = lv.filter(x => x >= 4).length,
        max = lv.filter(x => x === 5).length;
      facts.fire = { hi, max, n: lv.length };
      rows.push({
        group: 'pt',
        id: 'fire',
        k: 'Fire risk today',
        v: `${hi} of ${lv.length}`,
        sub: 'municipalities very high or maximum',
        src: `IPMA RCM · ${max} at maximum (5) · ${day}`,
        href: 'https://www.ipma.pt/pt/riscoincendio/rcm.pt/',
        o: 3,
      });
    }),
    task(async () => {
      const j = await getJSON('https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json');
      const active = parseWarnings(j);
      const by = (l: string) => active.filter(w => w.level === l).length;
      const types = [...new Set(active.map(w => w.type))].slice(0, 3).join(', ');
      facts.warnings = { red: by('red'), orange: by('orange'), yellow: by('yellow'), types };
      rows.push({
        group: 'pt',
        id: 'warnings',
        k: 'Weather warnings (IPMA)',
        v: active.length ? `${by('red')} red · ${by('orange')} orange · ${by('yellow')} yellow` : 'none',
        src: `IPMA${types ? ' · ' + types : ''}`,
        href: 'https://www.ipma.pt/pt/otempo/prev-sam/',
        o: 4,
      });
    }),
    task(async () => {
      const lat = PLACES.map(p => p[1]).join(','),
        lon = PLACES.map(p => p[2]).join(',');
      const [wx, aq] = await Promise.all([
        getJSON(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,precipitation_sum&timezone=auto&forecast_days=1`,
        ),
        getJSON(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`,
        ).catch(() => null),
      ]);
      const W = meteoPlaces(wx),
        A = meteoPlaces(aq);
      PLACES.forEach(([name, , , group], i) => {
        const tmax = meteoColumn(W[i], 'daily', 'temperature_2m_max')[0],
          rain = meteoColumn(W[i], 'daily', 'precipitation_sum')[0],
          aqi = num(at(A[i], 'current', 'european_aqi'));
        if (tmax == null) return;
        rows.push({
          group,
          id: `wx-${String(name).toLowerCase()}`,
          k: `${name} today`,
          v: `${nf0.format(tmax)}°C`,
          src: `Open-Meteo · rain ${nf1.format(rain ?? 0)} mm${aqi != null ? ` · air ${aqi} (${aqiWord(aqi)})` : ''}`,
          href: 'https://open-meteo.com/',
          o: 5 + i,
        });
      });
    }),
    // --- Planet: the slow numbers under everything else -----------------
    task(async () => {
      const j = await getJSON('https://global-warming.org/api/co2-api');
      const rows_ = parseCo2(j);
      const last = rows_[rows_.length - 1];
      if (!last) return;
      const yearAgo = rows_.find(r => r.t >= last.t - 365 * 86400e3);
      rows.push({
        group: 'planet',
        id: 'co2',
        k: 'CO₂ in the air · Mauna Loa',
        v: `${nf1.format(last.value)} ppm`,
        sub: `${yearAgo ? '+' + nf2.format(last.value - yearAgo.value) + ' ppm in a year' : ''}`,
        src: `NOAA trend via global-warming.org · ${new Date(last.t).toISOString().slice(0, 10)}`,
        href: 'https://gml.noaa.gov/ccgg/trends/',
        o: 20,
        spark: rows_.filter((_, i) => i % 30 === 0 || i === rows_.length - 1).slice(-61), // ~5 years, monthly
      });
    }),
    task(async () => {
      const j = await getJSON('https://global-warming.org/api/arctic-api');
      const months = parseSeaIce(j);
      const d = months[months.length - 1];
      if (!d) return;
      const m = d.month;
      rows.push({
        group: 'planet',
        id: 'seaice',
        k: 'Global sea ice extent',
        v: `${nf2.format(d.value)} M km²`,
        sub: `${d.anom > 0 ? '+' : ''}${nf2.format(d.anom)} vs the 1991–2020 norm for the month`,
        src: `NSIDC via global-warming.org · ${m.slice(0, 4)}-${m.slice(4)}`,
        href: 'https://nsidc.org/sea-ice-today',
        o: 21,
        // the anomaly, so the seasons don't drown the trend
        spark: months
          .slice(-60)
          .map(k => ({ t: Date.UTC(+k.month.slice(0, 4), +k.month.slice(4) - 1), value: k.anom })),
      });
    }),
    // --- Housing: prices, rents, mortgages ------------------------------------
    task(async () => {
      const j = await getJSON(
        'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hpi_q?geo=PT&geo=NL&geo=EA&unit=RCH_A&purchase=TOTAL&lastTimePeriod=12',
      );
      HPI_AREAS.forEach(([geo, group, suffix, name]) => {
        const series = parseEurostat(j, { geo });
        const last = series[series.length - 1];
        if (!last) return;
        rows.push({
          group,
          id: `hpi-${suffix}`,
          k: `House prices · ${name}`,
          v: `${last.value >= 0 ? '+' : '−'}${nf1.format(Math.abs(last.value))}%`,
          sub: 'vs a year earlier',
          src: `Eurostat house price index · ${quarter(last.t)}`,
          href: 'https://ec.europa.eu/eurostat/databrowser/view/prc_hpi_q/default/table',
          o: 10,
          spark: series,
        });
      });
    }),
    task(async () => {
      const j = await getJSON(
        'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr?geo=PT&geo=NL&geo=EA21&unit=RCH_A&coicop18=CP041&lastTimePeriod=13',
      );
      AREAS.forEach(([geo, group, suffix, name]) => {
        const series = parseEurostat(j, { geo });
        const last = series[series.length - 1];
        if (!last) return;
        rows.push({
          group,
          id: `rent-${suffix}`,
          k: `Rents · ${name}`,
          v: `${last.value >= 0 ? '+' : '−'}${nf1.format(Math.abs(last.value))}%`,
          sub: 'actual rents vs a year earlier',
          src: `Eurostat HICP rents · ${month(last.t)}`,
          href: 'https://ec.europa.eu/eurostat/databrowser/view/prc_hicp_minr/default/table',
          o: 11,
          spark: series,
        });
      });
    }),
    task(async () => {
      const j = await getJSON(
        'https://data-api.ecb.europa.eu/service/data/MIR/M.PT+NL+U2.B.A2C.A.R.A.2250.EUR.N?format=jsondata&lastNObservations=13',
      );
      const AREA: Record<string, [DatapointGroup, string]> = {
        PT: ['pt', 'Portugal'],
        NL: ['nl', 'Netherlands'],
        U2: ['ea', 'Euro area'],
      };
      parseEcbSeries(j, 1).forEach((series, code) => {
        const area = AREA[code];
        if (!area) return;
        const last = series[series.length - 1];
        if (!last) return;
        rows.push({
          group: area[0],
          id: `mortgage-${area[0]}`,
          k: `Mortgage rate · ${area[1]}`,
          v: `${nf2.format(last.value)}%`,
          sub: 'new house-purchase loans',
          src: `ECB MFI interest rates · ${month(last.t)}`,
          href: 'https://data.ecb.europa.eu/data/datasets/MIR',
          o: 12,
          spark: series,
        });
      });
    }),
    // --- Energy: what powers the grid, and what it costs ------------------------
    task(async () => {
      const j = await getJSON(
        'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr?geo=PT&geo=NL&geo=EA21&unit=RCH_A&coicop18=NRG&lastTimePeriod=13',
      );
      AREAS.forEach(([geo, group, suffix, name]) => {
        const series = parseEurostat(j, { geo });
        const last = series[series.length - 1];
        if (!last) return;
        rows.push({
          group,
          id: `energyinfl-${suffix}`,
          k: `Energy prices · ${name}`,
          v: `${last.value >= 0 ? '+' : '−'}${nf1.format(Math.abs(last.value))}%`,
          sub: 'household energy vs a year earlier',
          src: `Eurostat HICP energy · ${month(last.t)}`,
          href: 'https://ec.europa.eu/eurostat/databrowser/view/prc_hicp_minr/default/table',
          o: 14,
          spark: series,
        });
      });
    }),
    task(async () => {
      const j = await getJSON(
        'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_cb_pem?geo=PT&geo=NL&siec=TOTAL&siec=RA000&unit=GWH&lastTimePeriod=13',
      );
      (
        [
          ['PT', 'pt', 'Portugal'],
          ['NL', 'nl', 'Netherlands'],
        ] as [string, DatapointGroup, string][]
      ).forEach(([geo, group, name]) => {
        const total = parseEurostat(j, { geo, siec: 'TOTAL' }),
          ren = parseEurostat(j, { geo, siec: 'RA000' });
        const series = ren
          .map(r => {
            const t = total.find(x => x.t === r.t);
            return t && t.value > 0 ? [{ t: r.t, value: (r.value / t.value) * 100 }] : [];
          })
          .flat();
        const last = series[series.length - 1];
        if (!last) return;
        rows.push({
          group,
          id: `renew-${group}`,
          k: `Renewable electricity · ${name}`,
          v: `${nf0.format(last.value)}%`,
          sub: 'share of electricity generated',
          src: `Eurostat nrg_cb_pem · ${month(last.t)}`,
          href: 'https://ec.europa.eu/eurostat/databrowser/view/nrg_cb_pem/default/table',
          o: 13,
          spark: series,
        });
      });
    }),
    task(async () => {
      const j = await getJSON(
        'https://api.open-meteo.com/v1/forecast?latitude=38.72,52.37&longitude=-9.14,4.9&daily=shortwave_radiation_sum,wind_speed_10m_max&past_days=29&forecast_days=1&timezone=auto',
      );
      (
        [
          ['lisbon', 'Lisbon', 'pt'],
          ['amsterdam', 'Amsterdam', 'nl'],
        ] as [string, string, DatapointGroup][]
      ).forEach(([id, name, group], i) => {
        const place = meteoPlaces(j)[i];
        const sun = meteoColumn(place, 'daily', 'shortwave_radiation_sum'),
          wind = meteoColumn(place, 'daily', 'wind_speed_10m_max'),
          n = sun.length;
        if (!n || sun[n - 1] == null) return;
        rows.push({
          group,
          id: `sun-${id}`,
          k: `Sun and wind · ${name} today`,
          v: `${nf1.format((sun[n - 1] ?? 0) / 3.6)} kWh/m²`,
          sub: `solar energy on flat ground · wind up to ${nf0.format(wind[n - 1] ?? 0)} km/h`,
          src: 'Open-Meteo · chart: last 30 days',
          href: 'https://open-meteo.com/',
          o: 15,
          spark: meteoTimes(place, 'daily').flatMap((t, k) => {
            const v = sun[k];
            return v == null ? [] : [{ t: Date.parse(t), value: v / 3.6 }];
          }),
        });
      });
    }),
    // --- Land: is the soil drying out? One card per place --------------------
    ...SOIL_PLACES.map(([id, name, lat, lon, group], i) =>
      task(async () => {
        const j = await getJSON(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=soil_moisture_3_to_9cm&daily=precipitation_sum&past_days=60&forecast_days=1&timezone=UTC`,
        );
        const byDay = new Map<string, number[]>();
        const soil = meteoColumn(j, 'hourly', 'soil_moisture_3_to_9cm');
        meteoTimes(j, 'hourly').forEach((t, k) => {
          const v = soil[k];
          if (v == null) return;
          const d = t.slice(0, 10);
          byDay.set(d, [...(byDay.get(d) || []), v]);
        });
        const days = [...byDay.entries()].map(([d, vs]) => ({
          t: Date.parse(d),
          value: vs.reduce((a, b) => a + b, 0) / vs.length,
        }));
        if (days.length < 31) return;
        const now = days[days.length - 1],
          before = days[days.length - 31];
        const rain = meteoColumn(j, 'daily', 'precipitation_sum')
          .slice(-31, -1)
          .reduce<number>((a, b) => a + (b ?? 0), 0);
        const change = ((now.value - before.value) / (before.value || 1)) * 100;
        rows.push({
          group,
          id,
          k: `Soil moisture · ${name}`,
          v: `${nf2.format(now.value)} m³/m³`,
          sub: `${change >= 0 ? '+' : ''}${nf0.format(change)}% in 30 days · ${nf0.format(rain)} mm of rain`,
          src: 'Open-Meteo · 3–9 cm below the surface',
          href: 'https://open-meteo.com/en/docs',
          o: 22 + i,
          spark: days,
        });
      }),
    ),
  ]);
  dp.rows = rows.sort((a, b) => a.o - b.o);
  dp.facts = facts;
  dp.at = Date.now();
}

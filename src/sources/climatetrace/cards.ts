// PRECOG / Trend Radar · Climate TRACE cards: each country's emissions and world rank, the world's, forests and
// land (in Portugal, a sink most years and a large source in a fire year), waste, and the largest single emitter.
// Climate TRACE answers one period per request, so a series is one request per year: each loader fetches its
// years once a day (keptForADay), two at a time.
import type { SeriesPoint } from '@/types';
import { fmtPct, nf0, nf1 } from '@core/format';
import { type DatapointGroup, type DatapointRow, keptForADay, registerCards } from '@sources/cards';
import { getJSON, pool } from '@sources/registry';
import { type CountryEmissions, parseCountryEmissions, parseTopAsset } from './parse';

const API = 'https://api.climatetrace.org/v6';
const HREF = 'https://climatetrace.org/explore';
const COUNTRIES: [string, DatapointGroup, string][] = [
  ['PRT', 'pt', 'Portugal'],
  ['NLD', 'nl', 'Netherlands'],
];
/** The series start in 2017, so Portugal's fire year is in every chart. */
const FIRST = 2017;
/** The last year Climate TRACE has in full: its months arrive with a lag, so in January and February, two back. */
export const lastFullYear = (now = new Date()): number => now.getUTCFullYear() - (now.getUTCMonth() >= 2 ? 1 : 2);
const yearsTo = (last: number): number[] => Array.from({ length: last - FIRST + 1 }, (_, i) => FIRST + i);

/** Each year's emissions for both countries, for one sector or all of them (which leave out forests and land). */
async function byYear(sector: string | null): Promise<{ year: number; rows: CountryEmissions[] }[]> {
  const years = yearsTo(lastFullYear());
  const out: { year: number; rows: CountryEmissions[] }[] = [];
  await pool(years, 2, async year => {
    const url =
      `${API}/country/emissions?since=${year}&to=${year}&countries=${COUNTRIES.map(c => c[0]).join(',')}` +
      (sector ? `&sectors=${sector}` : '');
    out.push({ year, rows: parseCountryEmissions(await getJSON(url)) });
  });
  return out.sort((a, b) => a.year - b.year);
}

const point = (year: number, value: number): SeriesPoint => ({ t: Date.UTC(year, 0, 1), value });
/** One country's series in megatonnes, oldest first. */
const seriesOf = (data: { year: number; rows: CountryEmissions[] }[], iso: string): SeriesPoint[] =>
  data.flatMap(({ year, rows }) => {
    const c = rows.find(r => r.country === iso);
    return c ? [point(year, c.co2e / 1e6)] : [];
  });
const yearOf = (p: SeriesPoint): number => new Date(p.t).getUTCFullYear();
/** Megatonnes: one decimal below 100. */
const mt = (v: number): string => (Math.abs(v) < 100 ? nf1 : nf0).format(v);
/** With a sign, and a real minus: "−57.7", "+80.7". */
const signed = (v: number): string => `${v < 0 ? '−' : '+'}${mt(Math.abs(v))}`;
const pctSince = (s: SeriesPoint[]): string =>
  s.length > 1 && s[0].value > 0
    ? `${fmtPct(((s[s.length - 1].value - s[0].value) / s[0].value) * 100)} since ${yearOf(s[0])}`
    : '';
const both = (...parts: string[]): string => parts.filter(Boolean).join(' · ');

registerCards({
  id: 'climatetrace-total',
  async load() {
    const data = await keptForADay('precog.ctrace.total.v1', () => byYear(null));
    const rows: DatapointRow[] = [];
    const latest = data[data.length - 1];
    COUNTRIES.forEach(([iso, group, name]) => {
      const s = seriesOf(data, iso);
      const last = s[s.length - 1];
      if (!last) return;
      const rank = latest?.rows.find(r => r.country === iso)?.rank;
      rows.push({
        group,
        id: `ctrace-${group}`,
        k: `Emissions · ${name}`,
        v: `${mt(last.value)} Mt`,
        sub: both(`CO₂e in ${yearOf(last)}`, rank ? `world #${rank}` : '', pctSince(s)),
        src: `Climate TRACE · ${yearOf(last)}, not counting forests and land`,
        href: HREF,
        o: 30,
        spark: s,
      });
    });
    // The world's total comes with every country's reply.
    const world = data.flatMap(({ year, rows: r }) => (r[0]?.world != null ? [point(year, r[0].world / 1e9)] : []));
    const last = world[world.length - 1];
    if (last)
      rows.push({
        group: 'planet',
        id: 'ctrace-world',
        k: 'World emissions',
        v: `${nf1.format(last.value)} Gt`,
        sub: both(`CO₂e in ${yearOf(last)}`, pctSince(world)),
        src: `Climate TRACE · ${yearOf(last)}, not counting forests and land`,
        href: HREF,
        o: 30,
        spark: world,
      });
    return rows;
  },
});

registerCards({
  id: 'climatetrace-land',
  async load() {
    const data = await keptForADay('precog.ctrace.land.v1', () => byYear('forestry-and-land-use'));
    return COUNTRIES.flatMap(([iso, group, name]): DatapointRow[] => {
      const s = seriesOf(data, iso);
      const last = s[s.length - 1];
      if (!last) return [];
      // The year that released the most: in Portugal, a fire year.
      const most = s.reduce((a, b) => (b.value > a.value ? b : a));
      return [
        {
          group,
          id: `ctland-${group}`,
          k: `Forests & land · ${name}`,
          v: `${signed(last.value)} Mt`,
          sub: both(
            `CO₂e ${last.value < 0 ? 'taken up' : 'released'} in ${yearOf(last)}`,
            most !== last && most.value > 0 ? `most released: ${signed(most.value)} Mt in ${yearOf(most)}` : '',
          ),
          src: `Climate TRACE · since ${yearOf(s[0])}`,
          href: HREF,
          o: 25,
          spark: s,
        },
      ];
    });
  },
});

registerCards({
  id: 'climatetrace-waste',
  async load() {
    const data = await keptForADay('precog.ctrace.waste.v1', () => byYear('waste'));
    return COUNTRIES.flatMap(([iso, group, name]): DatapointRow[] => {
      const s = seriesOf(data, iso);
      const last = s[s.length - 1];
      if (!last) return [];
      return [
        {
          group,
          id: `ctwaste-${group}`,
          k: `Waste emissions · ${name}`,
          v: `${mt(last.value)} Mt`,
          sub: both(`CO₂e in ${yearOf(last)}, from handling waste`, pctSince(s)),
          src: `Climate TRACE · since ${yearOf(s[0])}`,
          href: HREF,
          o: 31,
          spark: s,
        },
      ];
    });
  },
});

registerCards({
  id: 'climatetrace-top',
  async load() {
    // The year is kept with the result, so the card always names the year it was fetched for.
    const { year, tops } = await keptForADay('precog.ctrace.top.v1', async () => {
      const y = lastFullYear();
      const found = await Promise.all(
        COUNTRIES.map(async ([iso]) =>
          parseTopAsset(await getJSON(`${API}/assets?countries=${iso}&limit=1&year=${y}`)),
        ),
      );
      return { year: y, tops: found };
    });
    return COUNTRIES.flatMap(([, group, name], i): DatapointRow[] => {
      const a = tops[i];
      if (!a) return [];
      return [
        {
          group,
          id: `cttop-${group}`,
          k: `Largest emitter · ${name}`,
          v: `${mt(a.co2e / 1e6)} Mt`,
          sub: both(a.name, a.sector ? `${a.sector.replace(/-/g, ' ')}, CO₂e in ${year}` : `CO₂e in ${year}`),
          src: `Climate TRACE · ${year}`,
          href: HREF,
          o: 32,
        },
      ];
    });
  },
});

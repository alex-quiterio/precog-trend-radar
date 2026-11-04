// PRECOG / Trend Radar · Datapoints panel: ECB, Eurostat, IPMA and Open-Meteo.
import { nf0, nf1, nf2 } from '../core/format';
import { bump } from '../core/ui-store';
import { getJSON } from '../sources/registry';

export interface DatapointRow {
  k: string;
  v: string;
  sub?: string;
  src: string;
  href: string;
  o: number;
}
export interface DatapointFacts {
  fire?: { hi: number; max: number; n: number };
  warnings?: { red: number; orange: number; yellow: number; types: string };
}
export const dp = { rows: [] as DatapointRow[], at: 0, facts: {} as DatapointFacts };
export const PLACES = [
  ['Lisbon', 38.72, -9.14],
  ['Porto', 41.15, -8.61],
  ['Amsterdam', 52.37, 4.9],
];
export const aqiWord = v =>
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
export async function loadDatapoints() {
  const rows: DatapointRow[] = [],
    facts: DatapointFacts = {};
  const task = async fn => {
    try {
      await fn();
    } catch (e) {
      /* one source failing never blocks the others */
    }
  };
  await Promise.all([
    task(async () => {
      const j = await getJSON(
        'https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.4F.KR.DFR.LEV?format=jsondata&lastNObservations=1',
      );
      const s = Object.values(j.dataSets[0].series)[0] as { observations: Record<string, number[]> },
        obs = Object.values(s.observations)[0][0];
      const since = j.structure.dimensions.observation[0].values.slice(-1)[0].id;
      rows.push({
        k: 'ECB deposit rate',
        v: `${nf2.format(obs)}%`,
        src: `ECB Data Portal · since ${since}`,
        href: 'https://data.ecb.europa.eu/',
        o: 1,
      });
    }),
    task(async () => {
      const j = await getJSON(
        'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/une_rt_m?geo=PT&geo=NL&geo=EA21&s_adj=SA&age=TOTAL&sex=T&unit=PC_ACT&lastTimePeriod=1',
      );
      const g = j.dimension.geo.category.index,
        t = Object.keys(j.dimension.time.category.index)[0];
      const val = c => j.value[String(g[c])];
      rows.push({
        k: 'Unemployment · PT / NL / euro area',
        v: ['PT', 'NL', 'EA21'].map(c => (val(c) == null ? '—' : nf1.format(val(c)) + '%')).join(' · '),
        src: `Eurostat une_rt_m · ${t}, seasonally adjusted`,
        href: 'https://ec.europa.eu/eurostat/databrowser/view/une_rt_m/default/table',
        o: 2,
      });
    }),
    task(async () => {
      const j = await getJSON('https://api.ipma.pt/open-data/forecast/meteorology/rcm/rcm-d0.json');
      const lv = Object.values(j.local as Record<string, { data: { rcm: number } }>).map(x => x.data.rcm);
      const hi = lv.filter(x => x >= 4).length,
        max = lv.filter(x => x === 5).length;
      facts.fire = { hi, max, n: lv.length };
      rows.push({
        k: 'Fire risk · Portugal, today',
        v: `${hi} of ${lv.length}`,
        sub: 'municipalities very high or maximum',
        src: `IPMA RCM · ${max} at maximum (5) · ${j.dataPrev}`,
        href: 'https://www.ipma.pt/pt/riscoincendio/rcm.pt/',
        o: 3,
      });
    }),
    task(async () => {
      const j = await getJSON('https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json');
      const now = Date.now(),
        active = j.filter(w => w.awarenessLevelID !== 'green' && Date.parse(w.endTime) > now);
      const by = l => active.filter(w => w.awarenessLevelID === l).length;
      const types = [...new Set(active.map(w => w.awarenessTypeName))].slice(0, 3).join(', ');
      facts.warnings = { red: by('red'), orange: by('orange'), yellow: by('yellow'), types };
      rows.push({
        k: 'Weather warnings · Portugal',
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
      const W = Array.isArray(wx) ? wx : [wx],
        A = aq ? (Array.isArray(aq) ? aq : [aq]) : [];
      PLACES.forEach(([name], i) => {
        const d = W[i]?.daily,
          aqi = A[i]?.current?.european_aqi;
        if (!d) return;
        rows.push({
          k: `${name} today`,
          v: `${nf0.format(d.temperature_2m_max[0])}°C`,
          src: `Open-Meteo · rain ${nf1.format(d.precipitation_sum[0])} mm${aqi != null ? ` · air ${aqi} (${aqiWord(aqi)})` : ''}`,
          href: 'https://open-meteo.com/',
          o: 5 + i,
        });
      });
    }),
  ]);
  dp.rows = rows.sort((a, b) => a.o - b.o);
  dp.facts = facts;
  dp.at = Date.now();
  bump();
}

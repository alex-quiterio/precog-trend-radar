// PRECOG / Trend Radar · Eurostat cards: unemployment, inflation, house prices, rents, energy prices, renewables,
// and the yearly environment numbers (greenhouse gases, nitrate in groundwater, municipal waste, circular use).
import type { SeriesPoint } from '@/types';
import { type DatapointGroup, type DatapointRow, registerCards } from '@sources/cards';
import { fmtPct, nf0, nf1 } from '@core/format';
import { month, quarter } from '@core/dates';
import { getJSON } from '@sources/registry';
import { parseEurostat } from './parse';

/** Eurostat area code → card group, id suffix and name. */
const AREAS: [string, DatapointGroup, string, string][] = [
  ['PT', 'pt', 'pt', 'Portugal'],
  ['NL', 'nl', 'nl', 'Netherlands'],
  ['EA21', 'ea', 'ea', 'Euro area'],
];
/** House prices use 'EA' rather than 'EA21'. */
const HPI_AREAS: [string, DatapointGroup, string, string][] = [
  ['PT', 'pt', 'pt', 'Portugal'],
  ['NL', 'nl', 'nl', 'Netherlands'],
  ['EA', 'ea', 'ea', 'Euro area'],
];

registerCards({
  id: 'eurostat-unemployment',
  async load() {
    const rows: DatapointRow[] = [];
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
    return rows;
  },
});

// Eurostat's HICP moved to prc_hicp_minr (ECOICOP 2) in 2026; annual rate of change, 13 months.
registerCards({
  id: 'eurostat-inflation',
  async load() {
    const rows: DatapointRow[] = [];
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
    return rows;
  },
});

registerCards({
  id: 'eurostat-house-prices',
  async load() {
    const rows: DatapointRow[] = [];
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
    return rows;
  },
});

registerCards({
  id: 'eurostat-rents',
  async load() {
    const rows: DatapointRow[] = [];
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
    return rows;
  },
});

registerCards({
  id: 'eurostat-energy-prices',
  async load() {
    const rows: DatapointRow[] = [];
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
    return rows;
  },
});

registerCards({
  id: 'eurostat-renewables',
  async load() {
    const rows: DatapointRow[] = [];
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
    return rows;
  },
});

/** The countries with yearly environment cards: Eurostat code, group and id suffix, name. */
const COUNTRIES: [string, DatapointGroup, string][] = [
  ['PT', 'pt', 'Portugal'],
  ['NL', 'nl', 'Netherlands'],
];
const year = (t: number): number => new Date(t).getUTCFullYear();
/** "−12.5% since 2013": the last year against the first one in the series. */
const pctSince = (s: SeriesPoint[]): string =>
  s.length > 1 && s[0].value
    ? `${fmtPct(((s[s.length - 1].value - s[0].value) / s[0].value) * 100)} since ${year(s[0].t)}`
    : '';
/** "+0.4 pts since 2013", for numbers that are already a percentage. */
const ptsSince = (s: SeriesPoint[]): string => {
  if (s.length < 2) return '';
  const d = s[s.length - 1].value - s[0].value;
  return `${d >= 0 ? '+' : '−'}${nf1.format(Math.abs(d))} pts since ${year(s[0].t)}`;
};
const both = (...parts: string[]): string => parts.filter(Boolean).join(' · ');

/**
 * A yearly dataset with one series per country: a loader making one card each for Portugal and the Netherlands.
 * `card` gets the country's series (oldest first, never empty) and returns what is particular to the card.
 */
function yearlyCards(
  code: string,
  query: string,
  idPrefix: string,
  o: number,
  card: (series: SeriesPoint[], name: string) => Pick<DatapointRow, 'k' | 'v' | 'sub'> & { by?: string },
): void {
  registerCards({
    id: `eurostat-${code}`,
    async load() {
      const j = await getJSON(
        `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${code}?geo=PT&geo=NL${query}&lastTimePeriod=12`,
      );
      return COUNTRIES.flatMap(([geo, group, name]) => {
        const series = parseEurostat(j, { geo });
        const last = series[series.length - 1];
        if (!last) return [];
        const { by, ...text } = card(series, name);
        return [
          {
            group,
            id: `${idPrefix}-${group}`,
            ...text,
            src: `Eurostat ${code}${by ? ` (${by})` : ''} · ${year(last.t)}`,
            href: `https://ec.europa.eu/eurostat/databrowser/view/${code}/default/table`,
            o,
            spark: series,
          },
        ];
      });
    },
  });
}

// Net emissions: what the country emits, less what its forests and land take up.
yearlyCards('sdg_13_10', '&unit=T_HAB&src_crf=TOTXMEMO', 'ghg', 27, (s, name) => ({
  k: `Greenhouse gases · ${name}`,
  v: `${nf1.format(s[s.length - 1].value)} t`,
  sub: both('CO₂e per person a year, net of land and forests', pctSince(s)),
  by: 'EEA',
}));
yearlyCards('sdg_06_40', '', 'nitrate', 26, (s, name) => ({
  k: `Nitrate in groundwater · ${name}`,
  v: `${nf1.format(s[s.length - 1].value)} mg/L`,
  sub: both('the drinking-water limit is 50 mg/L', pctSince(s)),
  by: 'EEA',
}));
yearlyCards('env_wasmun', '&wst_oper=GEN&unit=KG_HAB', 'waste', 28, (s, name) => ({
  k: `Municipal waste · ${name}`,
  v: `${nf0.format(s[s.length - 1].value)} kg`,
  sub: both('per person a year', pctSince(s)),
}));
yearlyCards('sdg_12_41', '', 'circular', 29, (s, name) => ({
  k: `Circular material use · ${name}`,
  v: `${nf1.format(s[s.length - 1].value)}%`,
  sub: both('of the materials used were recycled ones', ptsSince(s)),
}));

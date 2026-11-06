// PRECOG / Trend Radar · Eurostat cards: unemployment, inflation, house prices, rents, energy prices, renewables.
import { type DatapointGroup, type DatapointRow, registerCards } from '@sources/cards';
import { nf0, nf1 } from '@core/format';
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

// PRECOG / Trend Radar · Planet cards: CO₂ in the air (NOAA) and global sea-ice extent (NSIDC).
import { type DatapointRow, registerCards } from '@sources/cards';
import { nf1, nf2 } from '@core/format';
import { getJSON } from '@sources/registry';
import { parseCo2, parseSeaIce } from './parse';

registerCards({
  id: 'global-warming-co2',
  async load() {
    const rows: DatapointRow[] = [];
    const j = await getJSON('https://global-warming.org/api/co2-api');
    const rows_ = parseCo2(j);
    const last = rows_[rows_.length - 1];
    if (!last) return rows;
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
    return rows;
  },
});

registerCards({
  id: 'global-warming-sea-ice',
  async load() {
    const rows: DatapointRow[] = [];
    const j = await getJSON('https://global-warming.org/api/arctic-api');
    const months = parseSeaIce(j);
    const d = months[months.length - 1];
    if (!d) return rows;
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
      spark: months.slice(-60).map(k => ({ t: Date.UTC(+k.month.slice(0, 4), +k.month.slice(4) - 1), value: k.anom })),
    });
    return rows;
  },
});

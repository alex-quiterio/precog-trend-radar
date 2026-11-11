// PRECOG / Trend Radar · World Bank cards: how much of the land is forest (the FAO's count), year by year.
import { nf1 } from '@core/format';
import { type DatapointGroup, type DatapointRow, keptForADay, registerCards } from '@sources/cards';
import { getJSON } from '@sources/registry';
import { parseIndicator } from './parse';

const COUNTRIES: [string, DatapointGroup, string][] = [
  ['PRT', 'pt', 'Portugal'],
  ['NLD', 'nl', 'Netherlands'],
];

registerCards({
  id: 'worldbank-forest-area',
  async load() {
    const data = await keptForADay('precog.forest.v1', async () =>
      parseIndicator(
        await getJSON(
          `https://api.worldbank.org/v2/country/${COUNTRIES.map(c => c[0]).join(';')}/indicator/AG.LND.FRST.ZS?format=json&date=2000:${new Date().getUTCFullYear()}&per_page=200`,
        ),
      ),
    );
    return COUNTRIES.flatMap(([iso, group, name]): DatapointRow[] => {
      const series = data[iso] ?? [];
      const last = series[series.length - 1],
        first = series[0];
      if (!last) return [];
      const change = last.value - first.value;
      return [
        {
          group,
          id: `forest-${group}`,
          k: `Forest · ${name}`,
          v: `${nf1.format(last.value)}%`,
          sub:
            'of the land' +
            (first !== last
              ? ` · ${change >= 0 ? '+' : '−'}${nf1.format(Math.abs(change))} pts since ${first.year}`
              : ''),
          src: `World Bank (FAO) · ${last.year}`,
          href: `https://data.worldbank.org/indicator/AG.LND.FRST.ZS?locations=${iso.slice(0, 2)}`,
          o: 25,
          spark: series.map(p => ({ t: Date.UTC(p.year, 0, 1), value: p.value })),
        },
      ];
    });
  },
});

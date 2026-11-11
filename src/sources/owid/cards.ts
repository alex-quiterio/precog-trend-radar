// PRECOG / Trend Radar · Our World in Data cards: tree cover lost each year (Global Forest Watch's satellite
// count). It is every loss of trees over five metres, to fire and felling alike, so not "deforestation": a
// burnt or harvested stand that grows back is counted here too.
import { nf0 } from '@core/format';
import { type DatapointGroup, type DatapointRow, keptForADay, registerCards } from '@sources/cards';
import { getText } from '@sources/registry';
import { parseYearly, type Yearly } from './parse';

const COUNTRIES: [string, DatapointGroup, string][] = [
  ['PRT', 'pt', 'Portugal'],
  ['NLD', 'nl', 'Netherlands'],
];
const URL = 'https://ourworldindata.org/grapher/tree-cover-loss.csv?v=1&csvType=full&useColumnShortNames=true';

registerCards({
  id: 'owid-tree-cover-loss',
  async load() {
    // The file holds every country (145 KB): keep only the ones shown, for the day.
    const data = await keptForADay('precog.treeloss.v1', async () => {
      const all = parseYearly(await getText(URL), /tree_cover_loss/i);
      return Object.fromEntries(COUNTRIES.map(([iso]) => [iso, all[iso] ?? []])) as Record<string, Yearly[]>;
    });
    return COUNTRIES.flatMap(([iso, group, name]): DatapointRow[] => {
      const series = data[iso] ?? [];
      const last = series[series.length - 1];
      if (!last) return [];
      const worst = series.reduce((a, b) => (b.value > a.value ? b : a));
      return [
        {
          group,
          id: `treeloss-${group}`,
          k: `Tree cover lost · ${name}`,
          v: `${nf0.format(last.value)} ha`,
          sub:
            `in ${last.year}, to fire and felling` +
            (worst !== last ? ` · most: ${nf0.format(worst.value)} ha in ${worst.year}` : ''),
          src: `Global Forest Watch via Our World in Data · since ${series[0].year}`,
          href: `https://ourworldindata.org/grapher/tree-cover-loss?tab=chart&country=${iso}`,
          o: 24,
          spark: series.map(p => ({ t: Date.UTC(p.year, 0, 1), value: p.value })),
        },
      ];
    });
  },
});

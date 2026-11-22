// PRECOG / Trend Radar · BIS cards: inflation in the largest economies beyond the euro area (which has its own
// card, from Eurostat's HICP): the United States, China, Japan and India, consumer prices against a year
// earlier, monthly, from the BIS long consumer-price series.
import { month } from '@core/dates';
import { nf1 } from '@core/format';
import {
  type DatapointRow,
  registerCards,
} from '@sources/cards';
import { getJSON } from '@sources/registry';
import { parseBisSeries } from './parse';

/** BIS area code, card id suffix, name; in order of the economy's size. */
export const ECONOMIES: [string, string, string][] = [
  ['US', 'us', 'United States'],
  ['CN', 'cn', 'China'],
  ['JP', 'jp', 'Japan'],
  ['IN', 'in', 'India'],
];
// Unit 771: year-on-year change, in %. Thirteen months: a year of history for the small chart.
const URL = `https://stats.bis.org/api/v2/data/dataflow/BIS/WS_LONG_CPI/1.0/M.${ECONOMIES.map(e => e[0]).join('+')}.771?lastNObservations=13`;

registerCards({
  id: 'bis-inflation',
  cards: ECONOMIES.map(e => `inflation-${e[1]}`),
  async load() {
    const all = parseBisSeries(
      await getJSON(URL, undefined, {
        Accept:
          'application/vnd.sdmx.data+json;version=1.0.0',
      }),
    );
    return ECONOMIES.flatMap(
      ([code, suffix, name], i): DatapointRow[] => {
        const series = all[code] ?? [];
        const last = series[series.length - 1];
        if (!last) {
          return [];
        }
        const yearAgo = series[0];
        const d = last.value - yearAgo.value;
        return [
          {
            group: 'world',
            id: `inflation-${suffix}`,
            k: `Inflation · ${name}`,
            v: `${nf1.format(last.value)}%`,
            sub:
              series.length > 1
                ? `prices vs a year earlier · ${d >= 0 ? '+' : '−'}${nf1.format(Math.abs(d))} pts in a year`
                : 'prices vs a year earlier',
            src: `BIS consumer prices · ${month(last.t)}`,
            href: 'https://data.bis.org/topics/CPI',
            o: i + 1,
            spark: series,
          },
        ];
      },
    );
  },
});

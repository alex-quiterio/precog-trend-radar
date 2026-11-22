// PRECOG / Trend Radar · BIS cards (Bank for International Settlements), all from its keyless SDMX API:
// - World, Largest economies: inflation and central bank policy rates in the United States, China, Japan and
//   India (the euro area has its own cards, from Eurostat and the ECB).
// - Markets, Money & credit: global liquidity (dollar and euro credit to borrowers abroad), central bank
//   balance sheets, real effective exchange rates, and private credit with its gap from trend.
// One loader per dataset, so each fails on its own.
import type { SeriesPoint } from '@/types';
import { month, quarter } from '@core/dates';
import { fmtPct, nf0, nf1 } from '@core/format';
import {
  type DatapointRow,
  registerCards,
} from '@sources/cards';
import { getJSON } from '@sources/registry';
import { parseBisKeys, parseBisSeries } from './parse';

const API =
  'https://stats.bis.org/api/v2/data/dataflow/BIS';
const HREF = 'https://data.bis.org/';
/** Fetches one dataset's series by code ("WS_CBPOL", "1.0", "M.US+CN"), `n` periods back. */
const bis = async (
  flow: string,
  version: string,
  key: string,
  n: number,
): Promise<unknown> =>
  getJSON(
    `${API}/${flow}/${version}/${key}?lastNObservations=${n}`,
    undefined,
    {
      Accept:
        'application/vnd.sdmx.data+json;version=1.0.0',
    },
  );

/** The largest economies beyond the euro area: BIS area code, card id suffix, name; by size. */
export const ECONOMIES: [string, string, string][] = [
  ['US', 'us', 'United States'],
  ['CN', 'cn', 'China'],
  ['JP', 'jp', 'Japan'],
  ['IN', 'in', 'India'],
];
/** The four largest currency areas: BIS code, card id suffix, name, its central bank, its currency. */
const AREAS: [string, string, string, string, string][] = [
  ['US', 'us', 'United States', 'Fed', 'Dollar'],
  ['XM', 'ea', 'Euro area', 'ECB', 'Euro'],
  ['JP', 'jp', 'Japan', 'Bank of Japan', 'Yen'],
  ['CN', 'cn', 'China', 'People’s Bank of China', 'Yuan'],
];

const yearOf = (t: number) => new Date(t).getUTCFullYear();
/** The point a year before the last one (same month or quarter), if the series reaches back that far. */
function yearAgo(
  s: SeriesPoint[],
): SeriesPoint | undefined {
  const last = s[s.length - 1];
  if (!last) {
    return undefined;
  }
  const d = new Date(last.t);
  const t = Date.UTC(
    d.getUTCFullYear() - 1,
    d.getUTCMonth(),
    1,
  );
  return s.find(p => p.t === t);
}
/** "+0.7 pts in a year", for numbers that are already a percentage. */
function ptsInAYear(
  s: SeriesPoint[],
  fmt: Intl.NumberFormat = nf1,
): string {
  const last = s[s.length - 1],
    ago = yearAgo(s);
  if (!last || !ago) {
    return '';
  }
  const d = last.value - ago.value;
  if (fmt.format(Math.abs(d)) === fmt.format(0)) {
    return 'unchanged in a year';
  }
  return `${d >= 0 ? '+' : '−'}${fmt.format(Math.abs(d))} pts in a year`;
}
/** Policy rates move in quarter points (3.875%), so they keep up to three decimals. */
const rateFmt = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 3,
});
/** "−4.2% in a year". */
function pctInAYear(s: SeriesPoint[]): string {
  const last = s[s.length - 1],
    ago = yearAgo(s);
  return last && ago && ago.value
    ? `${fmtPct(((last.value - ago.value) / ago.value) * 100)} in a year`
    : '';
}
const both = (...parts: string[]) =>
  parts.filter(Boolean).join(' · ');
/** Trillions of dollars from billions: "$6.7 tn". */
const tn = (bn: number) => `$${nf1.format(bn / 1000)} tn`;

// --- World: inflation and policy rates ---------------------------------
registerCards({
  id: 'bis-inflation',
  cards: ECONOMIES.map(e => `inflation-${e[1]}`),
  async load() {
    // Unit 771: year-on-year change, in %. Thirteen months: a year of history for the small chart.
    const all = parseBisSeries(
      await bis(
        'WS_LONG_CPI',
        '1.0',
        `M.${ECONOMIES.map(e => e[0]).join('+')}.771`,
        13,
      ),
    );
    return ECONOMIES.flatMap(
      ([code, suffix, name], i): DatapointRow[] => {
        const series = all[code] ?? [];
        const last = series[series.length - 1];
        if (!last) {
          return [];
        }
        return [
          {
            group: 'world',
            id: `inflation-${suffix}`,
            k: `Inflation · ${name}`,
            v: `${nf1.format(last.value)}%`,
            sub: both(
              'prices vs a year earlier',
              ptsInAYear(series),
            ),
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

registerCards({
  id: 'bis-policy-rates',
  cards: ECONOMIES.map(e => `rate-${e[1]}`),
  async load() {
    const all = parseBisSeries(
      await bis(
        'WS_CBPOL',
        '1.0',
        `M.${ECONOMIES.map(e => e[0]).join('+')}`,
        13,
      ),
    );
    return ECONOMIES.flatMap(
      ([code, suffix, name], i): DatapointRow[] => {
        const series = all[code] ?? [];
        const last = series[series.length - 1];
        if (!last) {
          return [];
        }
        return [
          {
            group: 'world',
            id: `rate-${suffix}`,
            k: `Policy rate · ${name}`,
            v: `${rateFmt.format(last.value)}%`,
            sub: both(
              'the central bank’s rate',
              ptsInAYear(series, rateFmt),
            ),
            src: `BIS policy rates · ${month(last.t)}`,
            href: 'https://data.bis.org/topics/CBPOL',
            o: 10 + i,
            spark: series,
          },
        ];
      },
    );
  },
});

// --- Markets: money and credit -----------------------------------------
registerCards({
  id: 'bis-liquidity',
  cards: ['liquidity-usd', 'liquidity-eur'],
  async load() {
    // Credit (loans and debt securities) to non-banks outside the currency's home: the BIS's global
    // liquidity gauge. USD: the amount (millions); 771: growth on a year earlier, in %.
    const all = parseBisKeys(
      await bis(
        'WS_GLI',
        '1.0',
        'Q.USD+EUR.3P.N.A.I.B.USD+771',
        5,
      ),
    );
    const rows: DatapointRow[] = [];
    const usd = all['Q.USD.3P.N.A.I.B.USD'] ?? [],
      usdGrowth = all['Q.USD.3P.N.A.I.B.771'] ?? [],
      eurGrowth = all['Q.EUR.3P.N.A.I.B.771'] ?? [];
    const lastUsd = usd[usd.length - 1],
      lastUsdG = usdGrowth[usdGrowth.length - 1],
      lastEurG = eurGrowth[eurGrowth.length - 1];
    if (lastUsd) {
      rows.push({
        group: 'money',
        id: 'liquidity-usd',
        k: 'Dollar credit outside the US',
        v: tn(lastUsd.value / 1000),
        sub: both(
          'loans and bonds to borrowers abroad',
          lastUsdG
            ? `${fmtPct(lastUsdG.value)} in a year`
            : '',
        ),
        src: `BIS global liquidity · ${quarter(lastUsd.t)}`,
        href: 'https://data.bis.org/topics/GLI',
        o: 1,
        spark: usd,
      });
    }
    if (lastEurG) {
      rows.push({
        group: 'money',
        id: 'liquidity-eur',
        k: 'Euro credit outside the euro area',
        v: fmtPct(lastEurG.value),
        sub: 'growth in a year, loans and bonds to borrowers abroad',
        src: `BIS global liquidity · ${quarter(lastEurG.t)}`,
        href: 'https://data.bis.org/topics/GLI',
        o: 2,
        spark: eurGrowth,
      });
    }
    return rows;
  },
});

registerCards({
  id: 'bis-cb-assets',
  cards: AREAS.map(a => `cbassets-${a[1]}`),
  async load() {
    // In billions of US dollars, so the four compare (the Fed's own series is already in dollars).
    const all = parseBisSeries(
      await bis(
        'WS_CBTA',
        '1.0',
        'M.US+XM+JP+CN.B.USD+XDC.USD+_Z.B',
        13,
      ),
    );
    return AREAS.flatMap(
      ([code, suffix, , bank], i): DatapointRow[] => {
        const series = all[code] ?? [];
        const last = series[series.length - 1];
        if (!last) {
          return [];
        }
        return [
          {
            group: 'money',
            id: `cbassets-${suffix}`,
            k: `Balance sheet · ${bank}`,
            v: tn(last.value),
            sub: both(
              'central bank assets, in dollars',
              pctInAYear(series),
            ),
            src: `BIS central bank assets · ${month(last.t)}`,
            href: 'https://data.bis.org/topics/CBTA',
            o: 10 + i,
            spark: series,
          },
        ];
      },
    );
  },
});

registerCards({
  id: 'bis-eer',
  cards: AREAS.map(a => `eer-${a[1]}`),
  async load() {
    // Real, broad (64 economies): a currency's strength against its trading partners, adjusted for prices.
    const all = parseBisSeries(
      await bis('WS_EER', '1.0', 'M.R.B.US+XM+JP+CN', 13),
    );
    return AREAS.flatMap(
      ([code, suffix, , , currency], i): DatapointRow[] => {
        const series = all[code] ?? [];
        const last = series[series.length - 1];
        if (!last) {
          return [];
        }
        return [
          {
            group: 'money',
            id: `eer-${suffix}`,
            k: `${currency}, against its trading partners`,
            v: nf1.format(last.value),
            sub: both(
              'real effective rate, 2020 = 100',
              pctInAYear(series),
            ),
            src: `BIS effective exchange rates · ${month(last.t)}`,
            href: 'https://data.bis.org/topics/EER',
            o: 20 + i,
            spark: series,
          },
        ];
      },
    );
  },
});

registerCards({
  id: 'bis-credit',
  cards: AREAS.map(a => `credit-${a[1]}`),
  async load() {
    // Credit to households and companies as % of GDP, and its gap from the long-run trend. The BIS reads a
    // gap above 10 points as an early warning of a credit boom.
    const [credit, gap] = await Promise.all([
      bis('WS_TC', '2.0', 'Q.US+XM+JP+CN.P.A.M.770.A', 13),
      bis('WS_CREDIT_GAP', '1.0', 'Q.US+XM+JP+CN.P.A.C', 5),
    ]);
    const levels = parseBisSeries(credit, 'BORROWERS_CTY'),
      gaps = parseBisSeries(gap, 'BORROWERS_CTY');
    return AREAS.flatMap(
      ([code, suffix, name], i): DatapointRow[] => {
        const series = levels[code] ?? [];
        const last = series[series.length - 1];
        if (!last) {
          return [];
        }
        const g = gaps[code]?.at(-1);
        const gapText = g
          ? `${g.value >= 0 ? '+' : '−'}${nf1.format(Math.abs(g.value))} pts from trend${g.value > 10 ? ', above the BIS warning line' : ''}`
          : '';
        return [
          {
            group: 'money',
            id: `credit-${suffix}`,
            k: `Private credit · ${name}`,
            v: `${nf0.format(last.value)}% of GDP`,
            sub: both('households and companies', gapText),
            src: `BIS total credit · ${quarter(last.t)}, since ${yearOf(series[0].t)}`,
            href: HREF,
            o: 30 + i,
            spark: series,
          },
        ];
      },
    );
  },
});

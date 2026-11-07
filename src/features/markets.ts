// PRECOG / Trend Radar · Markets: real prices, not attention. Oil (EIA spot, $ a barrel), US stocks and AI
// leaders (tokenized ETFs and shares, which trade around the clock), AI and other crypto, gold, the whole
// crypto market and its Fear & Greed index (CoinGecko, alternative.me), and the euro and the dollar (ECB
// reference rates). Each instrument becomes a tile: its price, its last one or two weeks as a chart, and its
// day, week and month moves. Takeaways turn the numbers into a few plain sentences: facts, no forecasts.
// Five calls per load, each cached (CoinGecko throttles keyless callers, so its replies keep for ten minutes).
import { reactive } from 'vue';
import { HOUR, MIN, store } from '@core/config';
import { errorText, isAbort } from '@core/errors';
import type { SeriesPoint } from '@/types';
import { getJSON } from '@sources/registry';
import { type CoinQuote, type CryptoGlobal, parseCoinMarkets, parseGlobal } from '@sources/coingecko/parse';
import { parseEcbSeries } from '@sources/ecb/parse';
import { parseSpotPrices } from '@sources/eia/parse';
import { type FearGreed, parseFearGreed } from '@sources/feargreed/parse';

const DAY = 24 * HOUR;

/** One instrument on the board. */
export interface Tile {
  key: string;
  name: string;
  /** What exactly is priced, e.g. "SPY ETF share" or "$ a barrel, spot". */
  what: string;
  price: string;
  /** % moves over a day, a week and a month (null when unknown). */
  d1: number | null;
  w1: number | null;
  m1: number | null;
  /** The last one or two weeks of real prices, oldest first, and their low and high. */
  spark: SeriesPoint[];
  low: string;
  high: string;
  /** "7 days, hourly" or "14 days, daily". */
  span: string;
  /** When the latest price is from (ms). */
  asOf: number;
}
export interface TileGroup {
  id: string;
  label: string;
  hint: string;
  tiles: Tile[];
}

// --- What is on the board ---------------------------------------------
/** CoinGecko ids, by group: [id, name, what is priced]. */
export const STOCKS: [string, string, string][] = [
  ['sp500-xstock', 'S&P 500', 'SPY ETF share, tokenized'],
  ['nasdaq-xstock', 'Nasdaq-100', 'QQQ ETF share, tokenized'],
  ['nvidia-xstock', 'Nvidia', 'NVDA share, tokenized'],
  ['microsoft-xstock', 'Microsoft', 'MSFT share, tokenized'],
  ['alphabet-xstock', 'Alphabet', 'GOOGL share, tokenized'],
];
export const AI_TOKENS: [string, string, string][] = [
  ['bittensor', 'Bittensor', 'TAO: decentralized AI training'],
  ['render-token', 'Render', 'RENDER: GPU rendering and AI compute'],
  ['near', 'NEAR', 'NEAR: a chain pitched at AI agents'],
];
export const CRYPTO: [string, string, string][] = [
  ['bitcoin', 'Bitcoin', 'BTC'],
  ['ethereum', 'Ethereum', 'ETH'],
  ['solana', 'Solana', 'SOL'],
];
export const GOLD: [string, string, string][] = [['pax-gold', 'Gold', '$ a troy ounce (PAX Gold)']];
const COIN_IDS = [...STOCKS, ...AI_TOKENS, ...CRYPTO, ...GOLD].map(c => c[0]);
/** ECB currency codes, quoted per euro. */
export const FX = ['USD', 'GBP', 'JPY', 'CNY', 'CHF'];
const FX_NAME: Record<string, string> = {
  USD: 'US dollar',
  GBP: 'pound',
  JPY: 'yen',
  CNY: 'yuan',
  CHF: 'Swiss franc',
};

// --- Numbers -------------------------------------------------------------
/** The % move from the last point at or before `ago` ms earlier to the latest, or null. */
export function moveOver(series: SeriesPoint[], ago: number): number | null {
  const last = series[series.length - 1];
  const before = last && [...series].reverse().find(p => p.t <= last.t - ago + HOUR);
  return before && before.value ? ((last.value - before.value) / before.value) * 100 : null;
}
/** The last `days` of a series. */
const lastDays = (s: SeriesPoint[], days: number) => {
  const end = s[s.length - 1]?.t ?? 0;
  return s.filter(p => p.t > end - days * DAY);
};
const usd = (v: number) =>
  v >= 1000 ? '$' + Math.round(v).toLocaleString('en-US') : v >= 1 ? '$' + v.toFixed(2) : '$' + v.toPrecision(3);
const bigUsd = (v: number) => (v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : `$${(v / 1e9).toFixed(1)}B`);
/** "+2.4%", "−0.8%", "±0%". Markets write numbers one way (a decimal point), like the dollar prices beside them. */
export const pct = (p: number | null): string =>
  p == null ? '–' : `${p > 0.05 ? '+' : p < -0.05 ? '−' : '±'}${Math.abs(p).toFixed(1)}%`;
/** "+2.4% in a week and −1.0% in a month", for the moves that are known; '' for none. */
const moves = (parts: [number | null, string][]): string =>
  parts
    .filter(([p]) => p != null)
    .map(([p, when]) => `${pct(p)} ${when}`)
    .join(' and ');

function coinTile(q: CoinQuote, name: string, what: string): Tile {
  const prices = q.spark.map(p => p.value);
  return {
    key: q.id,
    name,
    what,
    price: usd(q.price),
    d1: q.ch24,
    w1: q.ch7,
    m1: q.ch30,
    spark: q.spark,
    low: prices.length ? usd(Math.min(...prices)) : '',
    high: prices.length ? usd(Math.max(...prices)) : '',
    span: '7 days, hourly',
    asOf: q.updated,
  };
}
function seriesTile(key: string, name: string, what: string, s: SeriesPoint[], fmt: (v: number) => string): Tile {
  const last = s[s.length - 1];
  const shown = lastDays(s, 14);
  const vals = shown.map(p => p.value);
  return {
    key,
    name,
    what,
    price: last ? fmt(last.value) : '–',
    d1: s.length > 1 ? ((last.value - s[s.length - 2].value) / s[s.length - 2].value) * 100 : null,
    w1: moveOver(s, 7 * DAY),
    m1: moveOver(s, 30 * DAY),
    spark: shown,
    low: vals.length ? fmt(Math.min(...vals)) : '',
    high: vals.length ? fmt(Math.max(...vals)) : '',
    span: '14 days, daily',
    asOf: last?.t ?? 0,
  };
}

/** Everything the board shows, as loaded (any part may be missing). */
export interface MarketData {
  quotes: CoinQuote[];
  global: CryptoGlobal | null;
  fng: FearGreed | null;
  oil: Map<string, SeriesPoint[]>;
  fx: Map<string, SeriesPoint[]>;
}
/** The euro against each currency, and the dollar against the yen (from the two euro rates). */
export function fxSeries(fx: Map<string, SeriesPoint[]>): [string, string, string, SeriesPoint[]][] {
  const out: [string, string, string, SeriesPoint[]][] = FX.flatMap(c => {
    const s = fx.get(c);
    return s?.length
      ? [[`eur-${c}`, `€ → ${FX_NAME[c]}`, `${c} per euro, ECB`, s] as [string, string, string, SeriesPoint[]]]
      : [];
  });
  const usdS = fx.get('USD'),
    jpy = fx.get('JPY');
  if (usdS?.length && jpy?.length) {
    const byT = new Map(usdS.map(p => [p.t, p.value]));
    const cross = jpy.flatMap(p => (byT.get(p.t) ? [{ t: p.t, value: p.value / byT.get(p.t)! }] : []));
    out.push(['usd-jpy', '$ → yen', 'JPY per dollar, from ECB rates', cross]);
  }
  return out;
}
export function boardOf(m: MarketData): TileGroup[] {
  const byId = new Map(m.quotes.map(q => [q.id, q]));
  const coins = (list: [string, string, string][]) =>
    list.flatMap(([id, name, what]) => (byId.get(id) ? [coinTile(byId.get(id)!, name, what)] : []));
  const oil = (
    [
      ['RBRTE', 'Brent crude'],
      ['RWTC', 'WTI crude'],
    ] as const
  ).flatMap(([id, name]) =>
    m.oil.get(id)?.length
      ? [seriesTile(id, name, '$ a barrel, spot (EIA)', m.oil.get(id)!, v => `$${v.toFixed(2)}`)]
      : [],
  );
  const fx = fxSeries(m.fx).map(([key, name, what, s]) =>
    seriesTile(key, name, what, s, v => (v >= 20 ? v.toFixed(2) : v.toFixed(4))),
  );
  return [
    { id: 'energy', label: 'Energy', hint: 'Oil, spot', tiles: oil },
    { id: 'stocks', label: 'Stocks & AI', hint: 'US indices and AI leaders', tiles: coins(STOCKS) },
    { id: 'ai', label: 'AI tokens', hint: 'Crypto networks for AI', tiles: coins(AI_TOKENS) },
    { id: 'crypto', label: 'Crypto', hint: 'The big three', tiles: coins(CRYPTO) },
    { id: 'gold', label: 'Gold', hint: 'The old safe haven', tiles: coins(GOLD) },
    { id: 'fx', label: 'Currencies', hint: 'ECB reference rates', tiles: fx },
  ].filter(g => g.tiles.length);
}

// --- Takeaways -------------------------------------------------------------
const way = (p: number | null, up: string, down: string, flat: string) =>
  p == null ? flat : p >= 0.5 ? up : p <= -0.5 ? down : flat;
const shortDay = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
/**
 * " This month it rose most against the yen (+1.2%) and fell most against the franc (−1.8%)." Only a real rise
 * (0.5% or more) is called one, and only a real fall; '' when the euro barely moved against any of them.
 */
function monthFx(best?: { c: string; m: number | null }, worst?: { c: string; m: number | null }): string {
  const parts = [
    best && best.m! >= 0.5 ? `rose most against the ${FX_NAME[best.c]} (${pct(best.m)})` : '',
    worst && worst.m! <= -0.5 ? `fell most against the ${FX_NAME[worst.c]} (${pct(worst.m)})` : '',
  ].filter(Boolean);
  return parts.length ? ` This month it ${parts.join(' and ')}.` : '';
}
/** A few plain sentences from the numbers: what moved, by how much. Facts only. */
export function takeaways(m: MarketData): string[] {
  const out: string[] = [];
  const q = (id: string) => m.quotes.find(x => x.id === id);
  const brent = m.oil.get('RBRTE');
  if (brent?.length) {
    const last = brent[brent.length - 1];
    const wti = m.oil.get('RWTC')?.at(-1);
    const mv = moves([
      [moveOver(brent, 7 * DAY), 'in a week'],
      [moveOver(brent, 30 * DAY), 'in a month'],
    ]);
    out.push(
      `Oil: Brent is $${last.value.toFixed(2)} a barrel (${shortDay(last.t)})${mv ? `, ${mv}` : ''}${wti ? `; WTI $${wti.value.toFixed(2)}` : ''}.`,
    );
  }
  const spx = q('sp500-xstock'),
    ndx = q('nasdaq-xstock');
  if (spx) {
    const leaders = STOCKS.slice(2)
      .map(([id, name]) => ({ name, w: q(id)?.ch7 ?? null }))
      .filter(x => x.w != null)
      .sort((a, b) => Math.abs(b.w!) - Math.abs(a.w!));
    out.push(
      `US stocks ${way(spx.ch7, 'rose', 'fell', 'were flat')} this week: S&P 500 ${pct(spx.ch7)}${ndx ? `, Nasdaq-100 ${pct(ndx.ch7)}` : ''}.` +
        (leaders[0] ? ` Of the AI leaders, ${leaders[0].name} moved most (${pct(leaders[0].w)}).` : ''),
    );
  }
  const ai = AI_TOKENS.map(([id, name]) => ({ name, w: q(id)?.ch7 ?? null })).filter(x => x.w != null);
  if (ai.length) {
    const avg = ai.reduce((a, b) => a + b.w!, 0) / ai.length;
    const most = [...ai].sort((a, b) => Math.abs(b.w!) - Math.abs(a.w!))[0];
    out.push(
      `AI tokens ${way(avg, 'rose', 'fell', 'were flat')} this week (${pct(avg)} on average); ${most.name} moved most (${pct(most.w)}).`,
    );
  }
  const btc = q('bitcoin');
  if (btc || m.global) {
    const parts: string[] = [];
    if (m.global)
      parts.push(
        `crypto is worth ${bigUsd(m.global.cap)}${m.global.ch24 != null ? ` (${pct(m.global.ch24)} in a day)` : ''}${m.global.btc != null ? `, ${m.global.btc.toFixed(1)}% of it Bitcoin` : ''}`,
      );
    if (btc) parts.push(`Bitcoin is ${usd(btc.price)} (${pct(btc.ch7)} this week)`);
    const f = m.fng?.series;
    if (f?.length) {
      const now = f[f.length - 1],
        weekAgo = [...f].reverse().find(p => p.t <= now.t - 7 * DAY + HOUR);
      parts.push(
        `sentiment reads ${m.fng!.label} (${now.value}${weekAgo ? `, from ${weekAgo.value} a week ago` : ''})`,
      );
    }
    out.push(parts.join('; ').replace(/^./, c => c.toUpperCase()) + '.');
  }
  const gold = q('pax-gold');
  if (gold) {
    const mv = moves([
      [gold.ch7, 'this week'],
      [gold.ch30, 'in a month'],
    ]);
    out.push(`Gold is ${usd(gold.price)} an ounce${mv ? `, ${mv}` : ''}.`);
  }
  if (spx && btc && gold && (spx.ch7 ?? 0) < -0.5 && (btc.ch7 ?? 0) < -0.5 && (gold.ch7 ?? 0) > 0.5)
    out.push('Taken together, a risk-off week: stocks and crypto down, gold up.');
  const fx = fxSeries(m.fx).filter(([k]) => k.startsWith('eur-'));
  const usdS = m.fx.get('USD');
  if (usdS?.length && fx.length) {
    const moves = fx
      .map(([key, name, , s]) => ({ c: key.slice(4).toUpperCase(), name, m: moveOver(s, 30 * DAY) }))
      .filter(x => x.m != null)
      .sort((a, b) => b.m! - a.m!);
    const best = moves[0],
      worst = moves[moves.length - 1];
    const mv = moveOver(usdS, 30 * DAY);
    out.push(
      `The euro buys $${usdS[usdS.length - 1].value.toFixed(4)}${mv != null ? ` (${pct(mv)} in a month)` : ''}.` +
        monthFx(best, worst),
    );
  }
  return out;
}

// --- Loading -------------------------------------------------------------
/** A reply kept in storage for `ttl` ms, so reopening the channel doesn't call again. */
async function cached(key: string, ttl: number, url: string, signal: AbortSignal): Promise<unknown> {
  const c = store.get<{ at: number; v: unknown } | null>(key, null);
  if (c && Date.now() - c.at < ttl) return c.v;
  try {
    const v = await getJSON(url, signal);
    store.set(key, { at: Date.now(), v });
    return v;
  } catch (e) {
    // Rate-limited or offline: an older reply beats none.
    if (c && !isAbort(e)) return c.v;
    throw e;
  }
}
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);

export function createMarkets() {
  const state = reactive({
    data: null as MarketData | null,
    loading: false,
    /** Parts that could not be read, e.g. "Oil (EIA): …". */
    errors: [] as string[],
    at: 0,
  });
  let abort: AbortController | null = null;
  async function load(): Promise<void> {
    abort?.abort();
    const ac = (abort = new AbortController());
    const { signal } = ac;
    state.loading = true;
    const errors: string[] = [];
    const part = async <T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await run();
      } catch (e) {
        if (!isAbort(e)) errors.push(`${label}: ${errorText(e)}`);
        return fallback;
      }
    };
    const now = Date.now();
    const [quotes, global, fng, oil, fx] = await Promise.all([
      part(
        'Prices (CoinGecko)',
        async () =>
          parseCoinMarkets(
            await cached(
              'precog.mkt.coins.v1',
              10 * MIN,
              `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COIN_IDS.join(',')}&sparkline=true&price_change_percentage=24h,7d,30d`,
              signal,
            ),
          ),
        [] as CoinQuote[],
      ),
      part(
        'Crypto market (CoinGecko)',
        async () =>
          parseGlobal(
            await cached('precog.mkt.global.v1', 10 * MIN, 'https://api.coingecko.com/api/v3/global', signal),
          ),
        null,
      ),
      part(
        'Fear & Greed',
        async () =>
          parseFearGreed(await cached('precog.mkt.fng.v1', HOUR, 'https://api.alternative.me/fng/?limit=31', signal)),
        null,
      ),
      part(
        'Oil (EIA)',
        async () =>
          parseSpotPrices(
            await cached(
              'precog.mkt.oil.v1',
              6 * HOUR,
              // EIA's public demo key: plenty for one call every few hours.
              `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=DEMO_KEY&frequency=daily&data[0]=value&facets[series][]=RBRTE&facets[series][]=RWTC&start=${ymd(now - 45 * DAY)}&sort[0][column]=period&sort[0][direction]=desc&length=80`,
              signal,
            ),
          ),
        new Map<string, SeriesPoint[]>(),
      ),
      part(
        'Currencies (ECB)',
        async () =>
          parseEcbSeries(
            await cached(
              'precog.mkt.fx.v1',
              6 * HOUR,
              `https://data-api.ecb.europa.eu/service/data/EXR/D.${FX.join('+')}.EUR.SP00.A?format=jsondata&lastNObservations=30`,
              signal,
            ),
            1,
          ),
        new Map<string, SeriesPoint[]>(),
      ),
    ]);
    if (signal.aborted) return;
    state.data = { quotes, global, fng, oil, fx };
    state.errors = errors;
    state.at = Date.now();
    state.loading = false;
  }
  return { state, load, stop: () => abort?.abort() };
}
export type Markets = ReturnType<typeof createMarkets>;

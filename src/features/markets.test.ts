// Markets: real prices into tiles and plain-sentence takeaways, from saved replies (6–7 Nov 2026).
import { describe, expect, it } from 'vitest';
import { boardOf, fxSeries, moveOver, pct, takeaways, type MarketData } from '@features/markets';
import { parseCoinMarkets, parseGlobal } from '@sources/coingecko/parse';
import { parseEcbSeries } from '@sources/ecb/parse';
import { parseSpotPrices } from '@sources/eia/parse';
import { parseFearGreed } from '@sources/feargreed/parse';
import coins from '@sources/coingecko/fixtures/coin-markets.json';
import global from '@sources/coingecko/fixtures/global.json';
import fng from '@sources/feargreed/fixtures/fng.json';
import spot from '@sources/eia/fixtures/spot.json';
import fx from '@sources/ecb/fixtures/fx-rates.json';

const DAY = 86400e3;
const data = (over: Partial<MarketData> = {}): MarketData => ({
  quotes: parseCoinMarkets(coins),
  global: parseGlobal(global),
  fng: parseFearGreed(fng),
  oil: parseSpotPrices(spot),
  fx: parseEcbSeries(fx, 1),
  ...over,
});

describe('the price board', () => {
  it('measures a move from the last point at or before the gap', () => {
    const t0 = Date.UTC(2026, 10, 1);
    const s = [100, 110, 121].map((value, i) => ({ t: t0 + i * 7 * DAY, value }));
    expect(moveOver(s, 7 * DAY)).toBeCloseTo(10);
    expect(moveOver(s, 14 * DAY)).toBeCloseTo(21);
    expect(moveOver(s, 30 * DAY)).toBeNull();
  });
  it('writes moves with a real minus and no "−0%"', () => {
    expect([pct(2.44), pct(-0.8), pct(0.01), pct(null)]).toEqual(['+2.4%', '−0.8%', '±0.0%', '–']);
  });
  it('groups real prices into tiles, with the low and high of the period', () => {
    const groups = boardOf(data());
    expect(groups.map(g => g.id)).toEqual(['energy', 'stocks', 'crypto', 'gold', 'fx']);
    const brent = groups[0].tiles[0];
    expect(brent).toMatchObject({ name: 'Brent crude', price: '$107.03', low: '$107.03', high: '$120.15' });
    expect(brent.d1).toBeCloseTo(((107.03 - 107.39) / 107.39) * 100);
    const nvda = groups[1].tiles[0];
    expect(nvda).toMatchObject({ name: 'Nvidia', price: '$187.69', w1: -8.2959, span: '7 days, hourly' });
  });
  it('quotes the euro against each currency, and the dollar against the yen', () => {
    const s = fxSeries(parseEcbSeries(fx, 1));
    expect(s.map(x => x[0])).toEqual(['eur-USD', 'eur-GBP', 'eur-JPY', 'eur-CNY', 'eur-CHF', 'usd-jpy']);
    expect(s.at(-1)![3].at(-1)!.value).toBeCloseTo(176.77 / 1.1165);
  });
});

describe('takeaways', () => {
  it('say what moved, in plain sentences with the real numbers', () => {
    expect(takeaways(data())).toEqual([
      'Oil: Brent is $107.03 a barrel (3 Nov); WTI $99.64.',
      'Crypto is worth $2.57T (−2.2% in a day), 59.3% of it Bitcoin; Bitcoin is $75,947 (−1.6% this week); sentiment reads Extreme Fear (25, from 30 a week ago).',
      'Gold is $4,062 an ounce, +4.3% this week and −1.5% in a month.',
      'The euro buys $1.1165.',
    ]);
  });
  it('tell how US stocks and the AI leaders moved, and name a risk-off week', () => {
    const base = parseCoinMarkets(coins);
    const quote = (id: string, ch7: number) => ({ ...base[0], id, ch7 });
    const t = takeaways(
      data({
        quotes: [...base, quote('sp500-xstock', -2.56), quote('nasdaq-xstock', -5.31), quote('microsoft-xstock', 1.4)],
      }),
    );
    expect(t).toContain(
      'US stocks fell this week: S&P 500 −2.6%, Nasdaq-100 −5.3%. Of the AI leaders, Nvidia moved most (−8.3%).',
    );
    expect(t).toContain('Taken together, a risk-off week: stocks and crypto down, gold up.');
  });
  it('only call a currency move a rise or a fall when it is one', () => {
    const t0 = Date.UTC(2026, 9, 1);
    const month = (from: number, to: number) => [
      { t: t0, value: from },
      { t: t0 + 31 * DAY, value: to },
    ];
    const fxNow = new Map([
      ['USD', month(1.12, 1.12)],
      ['JPY', month(176.8, 176.77)], // flat: never "rose most against the yen (±0.0%)"
      ['CHF', month(0.931, 0.9143)],
    ]);
    const line = takeaways({ quotes: [], global: null, fng: null, oil: new Map(), fx: fxNow }).at(-1);
    expect(line).toBe(
      'The euro buys $1.1200 (±0.0% in a month). This month it fell most against the Swiss franc (−1.8%).',
    );
  });
  it('leave out what could not be read', () => {
    expect(takeaways({ quotes: [], global: null, fng: null, oil: new Map(), fx: new Map() })).toEqual([]);
  });
});

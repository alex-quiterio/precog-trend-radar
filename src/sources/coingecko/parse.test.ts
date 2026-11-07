import { describe, expect, it } from 'vitest';
import markets from './fixtures/coin-markets.json';
import global from './fixtures/global.json';
import { parseCoinMarkets, parseGlobal } from './parse';
import { monthMove } from '@sources/markets';

const DAY = 86400e3;

describe('CoinGecko replies', () => {
  it('reads quotes with their 7-day hourly curve, ending at the last update', () => {
    const [btc] = parseCoinMarkets(markets);
    expect(btc).toMatchObject({ id: 'bitcoin', symbol: 'BTC', price: 75947, ch7: -1.5732 });
    expect(btc.spark).toHaveLength(6);
    expect(btc.spark[5].t).toBe(Date.parse('2026-11-07T07:16:53.000Z'));
    expect(btc.spark[5].t - btc.spark[4].t).toBe(3600e3);
  });
  it('reads tokenized shares the same way', () => {
    const nvda = parseCoinMarkets(markets).find(q => q.id === 'nvidia-xstock');
    expect(nvda).toMatchObject({ name: 'NVIDIA xStock', price: 187.69, ch7: -8.2959 });
  });
  it('skips a coin without a price, and refuses a reply that is not a list', () => {
    expect(parseCoinMarkets([{ id: 'x', current_price: null }])).toEqual([]);
    expect(() => parseCoinMarkets({ status: { error_code: 429 } })).toThrow(/unexpected format/);
  });
  it('reads the whole market', () => {
    expect(parseGlobal(global)).toEqual({
      cap: 2571651657252.596,
      ch24: -2.238865728596585,
      btc: 59.26773806138576,
      eth: 10.644054669997095,
    });
    expect(() => parseGlobal({ status: 'throttled' })).toThrow(/no market cap/);
  });
});

describe('a month’s move', () => {
  const t0 = Date.UTC(2026, 9, 1);
  const series = [0, 10, 20, 31].map((d, i) => ({ t: t0 + d * DAY, value: [100, 101, 102, 103][i] }));
  it('as a percentage, or in points for rates', () => {
    expect(monthMove(series, 'pct')).toBe('+3% in a month');
    expect(monthMove(series, 'pts')).toBe('+3.00 pts in a month');
    expect(
      monthMove(
        [
          { t: t0, value: 3 },
          { t: t0 + 31 * DAY, value: 2.85 },
        ],
        'pts',
      ),
    ).toBe('−0.15 pts in a month');
  });
  it('calls a move that rounds to nothing flat, never −0%', () => {
    expect(
      monthMove(
        [
          { t: t0, value: 176.8 },
          { t: t0 + 31 * DAY, value: 176.77 },
        ],
        'pct',
      ),
    ).toBe('flat over a month');
  });
  it('says nothing for less than a month of history', () => {
    expect(monthMove(series.slice(1), 'pct')).toBe('');
    expect(monthMove([], 'pct')).toBe('');
  });
});

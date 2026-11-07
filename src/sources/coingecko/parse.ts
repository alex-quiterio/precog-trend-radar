// PRECOG / Trend Radar · CoinGecko: reading coin, token and tokenized-stock quotes, and the whole crypto market.
import type { SeriesPoint } from '@/types';
import { ShapeError, at, list, listOr, num, str } from '@sources/shape';

const HOUR = 3600e3;
/** A coin, stock or ETF token as the markets endpoint reports it, in US dollars. */
export interface CoinQuote {
  id: string;
  symbol: string;
  name: string;
  price: number;
  /** % changes over 24 hours, 7 days and 30 days (null when CoinGecko has none). */
  ch24: number | null;
  ch7: number | null;
  ch30: number | null;
  volume: number;
  /** Hourly prices over the last 7 days, oldest first. */
  spark: SeriesPoint[];
  updated: number;
}
/**
 * The markets reply (/coins/markets?sparkline=true&price_change_percentage=24h,7d,30d). The 7-day sparkline
 * has no times: it is hourly, ending at the last update. Coins without a price are skipped.
 */
export function parseCoinMarkets(reply: unknown): CoinQuote[] {
  return list(reply, 'CoinGecko', 'markets').flatMap(c => {
    const price = num(at(c, 'current_price')),
      id = str(at(c, 'id'));
    if (price == null || !id) return [];
    const updated = Date.parse(str(at(c, 'last_updated'))) || Date.now();
    const raw = listOr(at(c, 'sparkline_in_7d', 'price'));
    const spark = raw.flatMap((v, i) => {
      const value = num(v);
      return value != null && value > 0 ? [{ t: updated - (raw.length - 1 - i) * HOUR, value }] : [];
    });
    return [
      {
        id,
        symbol: str(at(c, 'symbol')).toUpperCase(),
        name: str(at(c, 'name')),
        price,
        ch24: num(at(c, 'price_change_percentage_24h_in_currency')),
        ch7: num(at(c, 'price_change_percentage_7d_in_currency')),
        ch30: num(at(c, 'price_change_percentage_30d_in_currency')),
        volume: num(at(c, 'total_volume')) ?? 0,
        spark,
        updated,
      },
    ];
  });
}
/** The whole crypto market: its value in dollars, its 24-hour change (%), and Bitcoin's and Ether's shares (%). */
export interface CryptoGlobal {
  cap: number;
  ch24: number | null;
  btc: number | null;
  eth: number | null;
}
export function parseGlobal(reply: unknown): CryptoGlobal {
  const cap = num(at(reply, 'data', 'total_market_cap', 'usd'));
  if (cap == null) throw new ShapeError('CoinGecko', 'no market cap');
  return {
    cap,
    ch24: num(at(reply, 'data', 'market_cap_change_percentage_24h_usd')),
    btc: num(at(reply, 'data', 'market_cap_percentage', 'btc')),
    eth: num(at(reply, 'data', 'market_cap_percentage', 'eth')),
  };
}

// PRECOG / Trend Radar · EIA (US Energy Information Administration): reading daily oil spot prices.
import type { SeriesPoint } from '@/types';
import { at, list, num, str } from '@sources/shape';

/**
 * The spot-price reply (/v2/petroleum/pri/spt/data) as one series per EIA series id (RBRTE: Brent, RWTC: WTI),
 * in dollars a barrel, oldest first. Rows without a price are skipped.
 */
export function parseSpotPrices(reply: unknown): Map<string, SeriesPoint[]> {
  const out = new Map<string, SeriesPoint[]>();
  list(at(reply, 'response', 'data'), 'EIA', 'response.data').forEach(r => {
    const series = str(at(r, 'series')),
      day = str(at(r, 'period')),
      value = num(Number(str(at(r, 'value')) || NaN));
    if (!series || !/^\d{4}-\d{2}-\d{2}$/.test(day) || value == null) return;
    const s = out.get(series) ?? [];
    s.push({ t: Date.parse(`${day}T00:00:00Z`), value });
    out.set(series, s);
  });
  out.forEach(s => s.sort((a, b) => a.t - b.t));
  return out;
}

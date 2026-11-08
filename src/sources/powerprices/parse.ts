// PRECOG / Trend Radar · Day-ahead power prices: reading EnergyZero (the Netherlands, € a kWh) and REE (the
// Iberian market, € a MWh, in quarter hours) into one hourly shape, and finding the cheapest block of hours.
import { ShapeError, at, isObj, list, num, str } from '@sources/shape';

/** One hour's wholesale price, in € a kWh, from `t` (ms, the hour's start). */
export interface HourPrice {
  t: number;
  eurKwh: number;
}
const HOUR = 3600e3;

/** EnergyZero's energyprices reply as hourly prices, oldest first. */
export function parseEnergyZero(reply: unknown): HourPrice[] {
  return list(at(reply, 'Prices'), 'EnergyZero', 'Prices')
    .flatMap(p => {
      const t = Date.parse(str(at(p, 'readingDate'))),
        eurKwh = num(at(p, 'price'));
      return Number.isFinite(t) && eurKwh != null ? [{ t, eurKwh }] : [];
    })
    .sort((a, b) => a.t - b.t);
}

/** REE's real-time market prices reply: the spot series, averaged into hours, oldest first. */
export function parseReeSpot(reply: unknown): HourPrice[] {
  const series = list(at(reply, 'included'), 'REE', 'included').find(
    i => isObj(i) && (str(at(i, 'type')) === 'Spot market price' || str(at(i, 'id')) === '600'),
  );
  if (!series) throw new ShapeError('REE', 'no spot market price series');
  const hours = new Map<number, number[]>();
  list(at(series, 'attributes', 'values'), 'REE', 'values').forEach(v => {
    const t = Date.parse(str(at(v, 'datetime'))),
      mwh = num(at(v, 'value'));
    if (!Number.isFinite(t) || mwh == null) return;
    const h = Math.floor(t / HOUR) * HOUR;
    hours.set(h, [...(hours.get(h) || []), mwh / 1000]);
  });
  return [...hours.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, v]) => ({ t, eurKwh: v.reduce((a, b) => a + b, 0) / v.length }));
}

/** The cheapest run of `n` back-to-back hours starting at or after `from`: its start, end and mean price. */
export function cheapestBlock(
  prices: HourPrice[],
  n = 3,
  from = -Infinity,
): { start: number; end: number; avg: number } | null {
  let best: { start: number; end: number; avg: number } | null = null;
  for (let i = 0; i + n <= prices.length; i++) {
    const run = prices.slice(i, i + n);
    if (run[0].t < from) continue;
    if (run.some((p, k) => k > 0 && p.t - run[k - 1].t !== HOUR)) continue; // a gap in the data
    const avg = run.reduce((a, p) => a + p.eurKwh, 0) / n;
    if (!best || avg < best.avg) best = { start: run[0].t, end: run[n - 1].t + HOUR, avg };
  }
  return best;
}

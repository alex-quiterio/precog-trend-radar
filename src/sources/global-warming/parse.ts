// PRECOG / Trend Radar · global-warming.org: reading NOAA CO₂ and NSIDC sea-ice replies.
import type { SeriesPoint } from '@/types';
import { at, list, num, obj } from '@sources/shape';

/** NOAA's Mauna Loa CO₂ trend (via global-warming.org) as daily points, oldest first. */
export function parseCo2(reply: unknown): SeriesPoint[] {
  return list(at(reply, 'co2'), 'global-warming.org CO₂', 'co2').flatMap(r => {
    const y = num(at(r, 'year')),
      m = num(at(r, 'month')),
      d = num(at(r, 'day')),
      v = num(at(r, 'trend'));
    return y == null || m == null || d == null || v == null ? [] : [{ t: Date.UTC(y, m - 1, d), value: v }];
  });
}
/** NSIDC sea-ice extent by month (via global-warming.org): months with data, oldest first. */
export function parseSeaIce(reply: unknown): { month: string; value: number; anom: number }[] {
  const data = obj(at(reply, 'arcticData', 'data'), 'global-warming.org sea ice', 'arcticData.data');
  return Object.keys(data)
    .sort()
    .flatMap(month => {
      const value = num(at(data[month], 'value')),
        anom = num(at(data[month], 'anom'));
      return /^\d{6}$/.test(month) && value != null && value > 0 && anom != null ? [{ month, value, anom }] : [];
    });
}

// PRECOG / Trend Radar · The Crypto Fear & Greed Index (alternative.me): 0 is extreme fear, 100 extreme greed.
import type { SeriesPoint } from '@/types';
import { at, list, num, str } from '@sources/shape';

export interface FearGreed {
  /** Daily readings, oldest first. */
  series: SeriesPoint[];
  /** The latest reading's label, e.g. "Extreme Fear". */
  label: string;
}
export function parseFearGreed(reply: unknown): FearGreed {
  const rows = list(at(reply, 'data'), 'Fear & Greed', 'data');
  const series = rows
    .flatMap(r => {
      const value = num(Number(str(at(r, 'value')) || NaN)),
        t = num(Number(str(at(r, 'timestamp')) || NaN));
      return value != null && t != null ? [{ t: t * 1000, value }] : [];
    })
    .sort((a, b) => a.t - b.t);
  return { series, label: str(at(rows[0], 'value_classification')) };
}

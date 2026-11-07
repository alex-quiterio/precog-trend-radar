// PRECOG / Trend Radar · Small helpers for market cards (exchange rates, yields, prices).
import { nf1 } from '@core/format';
import type { SeriesPoint } from '@/types';

const DAY = 86400e3;
/**
 * How far a series moved in about a month, as a card's sub line: "+1.2% in a month" (pct) or "+0.15 pts in
 * a month" (pts, for rates). '' when the series is shorter than that.
 */
export function monthMove(series: SeriesPoint[], as: 'pct' | 'pts'): string {
  const last = series[series.length - 1];
  const before = last && [...series].reverse().find(p => p.t <= last.t - 30 * DAY);
  if (!last || !before || !before.value) return '';
  const d = as === 'pct' ? ((last.value - before.value) / before.value) * 100 : last.value - before.value;
  // A move that rounds to nothing is flat, never "−0%".
  if (Math.abs(d) < (as === 'pct' ? 0.05 : 0.005)) return 'flat over a month';
  const sign = d > 0 ? '+' : '−';
  return as === 'pct'
    ? `${sign}${nf1.format(Math.abs(d))}% in a month`
    : `${sign}${Math.abs(d).toFixed(2)} pts in a month`;
}

// PRECOG / Trend Radar · Luchtmeetnet (the Dutch air-quality network): reading a station's hourly measurements.
import type { SeriesPoint } from '@/types';
import { at, list, num, str } from '@sources/shape';

/** A station's measurements as points, oldest first. Records without a time or a value are skipped. */
export function parseMeasurements(reply: unknown): SeriesPoint[] {
  return list(at(reply, 'data'), 'Luchtmeetnet', 'data')
    .flatMap(m => {
      const t = Date.parse(str(at(m, 'timestamp_measured'))),
        value = num(at(m, 'value'));
      return Number.isFinite(t) && value != null ? [{ t, value }] : [];
    })
    .sort((a, b) => a.t - b.t);
}

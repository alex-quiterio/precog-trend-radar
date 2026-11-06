// PRECOG / Trend Radar · Eurostat: reading JSON-stat replies (inflation, jobs, house prices, energy).
import { periodStart } from '@core/dates';
import type { SeriesPoint } from '@/types';
import { ShapeError, at, list, num, obj, objOr, str } from '@sources/shape';

/**
 * One series out of a Eurostat JSON-stat reply: pick a value for each dimension you name (geo, siec…);
 * dimensions you don't name must have a single value. Time runs along the last dimension.
 * Periods without a value are skipped; a code you pick that isn't in the reply gives an empty series.
 */
export function parseEurostat(reply: unknown, pick: Record<string, string>): SeriesPoint[] {
  const j = obj(reply, 'Eurostat');
  const ids = list(j.id, 'Eurostat', 'id').map(str),
    size = list(j.size, 'Eurostat', 'size').map(n => num(n) ?? 0);
  const dims = obj(j.dimension, 'Eurostat', 'dimension');
  const times = Object.keys(objOr(at(dims, 'time', 'category', 'index')));
  const tIdx = ids.indexOf('time');
  if (tIdx !== ids.length - 1) throw new ShapeError('Eurostat', 'time is not the last dimension');
  let base = 0;
  for (let d = 0; d < ids.length - 1; d++) {
    const idx = pick[ids[d]] != null ? num(at(dims, ids[d], 'category', 'index', pick[ids[d]])) : 0;
    if (idx == null) return [];
    base = base * size[d] + idx;
  }
  const values = objOr(j.value);
  return times.flatMap((t, i) => {
    // time is the last dimension, so the flat index is base * nTimes + i
    const v = num(values[String(base * times.length + i)]);
    return v == null ? [] : [{ t: periodStart(t), value: v }];
  });
}

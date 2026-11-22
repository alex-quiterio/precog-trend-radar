// PRECOG / Trend Radar · BIS (Bank for International Settlements): reading its SDMX-JSON data replies. The
// long consumer-price series (WS_LONG_CPI) give each economy's inflation, month by month, from one source.
import { periodStart } from '@core/dates';
import type { SeriesPoint } from '@/types';
import {
  ShapeError,
  at,
  list,
  num,
  obj,
  objOr,
  str,
} from '@sources/shape';

/**
 * Each series in the reply by its full code, the dimension values joined by dots as in the query
 * ("Q.USD.3P.N.A.I.B.771"), oldest first. Periods without a number are skipped; a reply without series or
 * dimensions throws ShapeError.
 */
export function parseBisKeys(
  reply: unknown,
): Record<string, SeriesPoint[]> {
  const data = obj(at(reply, 'data'), 'BIS', 'data');
  const set = obj(
    list(data.dataSets, 'BIS', 'dataSets')[0],
    'BIS',
    'dataSet',
  );
  const dims = list(
    at(data, 'structure', 'dimensions', 'series'),
    'BIS',
    'series dimensions',
  ).map(d =>
    list(at(d, 'values'), 'BIS', 'dimension values').map(
      v => str(at(v, 'id')),
    ),
  );
  const times = list(
    at(
      data,
      'structure',
      'dimensions',
      'observation',
      0,
      'values',
    ),
    'BIS',
    'periods',
  ).map(v => str(at(v, 'id')));
  const out: Record<string, SeriesPoint[]> = {};
  for (const [key, s] of Object.entries(
    obj(set.series, 'BIS', 'series'),
  )) {
    const code = key
      .split(':')
      .map((j, d) => dims[d]?.[Number(j)] ?? '')
      .join('.');
    out[code] = Object.entries(objOr(at(s, 'observations')))
      .flatMap(([i, o]) => {
        const value = num(at(o, 0)),
          t = times[Number(i)];
        return value == null || !t
          ? []
          : [{ t: periodStart(t), value }];
      })
      .sort((a, b) => a.t - b.t);
  }
  return out;
}

/**
 * Each series in the reply by the value of one dimension (REF_AREA: "US", "JP"), oldest first. Throws
 * ShapeError when the reply has no such dimension.
 */
export function parseBisSeries(
  reply: unknown,
  dim = 'REF_AREA',
): Record<string, SeriesPoint[]> {
  const ids = list(
    at(reply, 'data', 'structure', 'dimensions', 'series'),
    'BIS',
    'series dimensions',
  ).map(d => str(at(d, 'id')));
  const pos = ids.indexOf(dim);
  if (pos < 0) {
    throw new ShapeError('BIS', `no ${dim} dimension`);
  }
  return Object.fromEntries(
    Object.entries(parseBisKeys(reply)).map(([code, s]) => [
      code.split('.')[pos],
      s,
    ]),
  );
}

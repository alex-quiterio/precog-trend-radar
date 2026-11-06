// PRECOG / Trend Radar · ECB Data Portal: reading SDMX-JSON replies (deposit rate, mortgage rates).
import { periodStart } from '@core/dates';
import type { SeriesPoint } from '@/types';
import { ShapeError, at, listOr, num, objOr, str } from '@sources/shape';

/** The single latest observation of an ECB SDMX-JSON reply, and the period it is for. */
export function parseEcbLatest(reply: unknown): { value: number; since: string } {
  const series = Object.values(objOr(at(reply, 'dataSets', 0, 'series')))[0];
  const value = num(at(Object.values(objOr(at(series, 'observations')))[0], 0));
  const periods = listOr(at(reply, 'structure', 'dimensions', 'observation', 0, 'values'));
  if (value == null) throw new ShapeError('ECB', 'no observation');
  return { value, since: str(at(periods[periods.length - 1], 'id')) };
}
/**
 * Every series of an ECB SDMX-JSON reply, keyed by the code of the series dimension at `dim`
 * (e.g. the country in MIR series keys), with observations oldest first.
 */
export function parseEcbSeries(reply: unknown, dim: number): Map<string, SeriesPoint[]> {
  const codes = listOr(at(reply, 'structure', 'dimensions', 'series', dim, 'values')).map(v => str(at(v, 'id')));
  const times = listOr(at(reply, 'structure', 'dimensions', 'observation', 0, 'values')).map(v =>
    periodStart(str(at(v, 'id'))),
  );
  const out = new Map<string, SeriesPoint[]>();
  Object.entries(objOr(at(reply, 'dataSets', 0, 'series'))).forEach(([key, ser]) => {
    const code = codes[+key.split(':')[dim]];
    if (!code) return;
    const points = Object.entries(objOr(at(ser, 'observations')))
      .flatMap(([i, o]) => {
        const value = num(at(o, 0)),
          t = times[+i];
        return value == null || t == null || !Number.isFinite(t) ? [] : [{ t, value }];
      })
      .sort((a, b) => a.t - b.t);
    out.set(code, points);
  });
  return out;
}

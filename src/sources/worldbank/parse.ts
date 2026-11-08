// PRECOG / Trend Radar · World Bank: reading an indicator reply ([paging, rows]) into yearly points per country.
import { ShapeError, at, list, num, str } from '@sources/shape';

/** One country's yearly values, oldest first. */
export type YearlyByCountry = Record<string, { year: number; value: number }[]>;

/** Rows by ISO3 code. Years without a value are skipped. Throws ShapeError on an error reply or a changed shape. */
export function parseIndicator(reply: unknown): YearlyByCountry {
  const parts = list(reply, 'World Bank');
  if (parts.length < 2) {
    const msg = str(at(parts[0], 'message', 0, 'value'));
    throw new ShapeError('World Bank', msg || 'no rows');
  }
  const out: YearlyByCountry = {};
  list(parts[1], 'World Bank', 'rows').forEach(r => {
    const iso = str(at(r, 'countryiso3code')),
      year = num(at(r, 'date')),
      value = num(at(r, 'value'));
    if (!iso || year == null || value == null) return;
    (out[iso] ||= []).push({ year, value });
  });
  Object.values(out).forEach(s => s.sort((a, b) => a.year - b.year));
  return out;
}

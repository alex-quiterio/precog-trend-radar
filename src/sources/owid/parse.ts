// PRECOG / Trend Radar · Our World in Data: reading OWID's grapher CSVs. The World Happiness Report's life
// evaluations (the Cantril ladder, 0–10) with each country's world rank in its latest year, and any yearly
// column (tree cover loss) as a series per country.
import { ShapeError } from '@sources/shape';

/** A country's latest score and where it ranks among every country scored that year (1 = happiest). */
export interface Happiness {
  /** OWID's name for it, e.g. "Finland". */
  name: string;
  year: number;
  score: number;
  rank: number;
  of: number;
}

/** Countries only: ISO3 codes, and Kosovo (OWID_KOS). OWID's other codes are regions and income groups. */
const isCountry = (code: string) => /^[A-Z]{3}$/.test(code) || code === 'OWID_KOS';

/** The CSV as each country's latest score and rank, by code. Throws ShapeError without the columns it reads. */
export function parseHappiness(csv: string): Record<string, Happiness> {
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  const head = (lines[0] || '').split(',');
  const code = head.indexOf('code'),
    year = head.indexOf('year'),
    score = head.findIndex(h => /cantril|ladder|happiness/i.test(h));
  if (code < 0 || year < 0 || score < 0) throw new ShapeError('Our World in Data', 'no code, year or score column');
  const byYear = new Map<number, { code: string; score: number }[]>();
  const names = new Map<string, string>();
  const latest = new Map<string, number>();
  for (const line of lines.slice(1)) {
    // Entity names can be quoted and hold commas: read the last columns from the right.
    const c = line.split(',');
    const off = c.length - head.length;
    const k = c[code + off],
      y = Number(c[year + off]),
      s = Number(c[score + off]);
    if (!k || !isCountry(k) || !Number.isFinite(y) || !Number.isFinite(s)) continue;
    names.set(
      k,
      c
        .slice(0, off + 1)
        .join(',')
        .replace(/^"|"$/g, ''),
    );
    byYear.set(y, [...(byYear.get(y) || []), { code: k, score: s }]);
    latest.set(k, Math.max(latest.get(k) ?? -Infinity, y));
  }
  const out: Record<string, Happiness> = {};
  latest.forEach((y, k) => {
    const all = [...(byYear.get(y) || [])].sort((a, b) => b.score - a.score);
    const i = all.findIndex(x => x.code === k);
    out[k] = { name: names.get(k) || k, year: y, score: all[i].score, rank: i + 1, of: all.length };
  });
  return out;
}

/** One year's value of a yearly column. */
export interface Yearly {
  year: number;
  value: number;
}

/**
 * A yearly column of a grapher CSV as each country's series, oldest first, by code. `column` matches the
 * column's short name. Regions and rows without a number are skipped. Throws ShapeError without the columns.
 */
export function parseYearly(csv: string, column: RegExp): Record<string, Yearly[]> {
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  const head = (lines[0] || '').split(',');
  const code = head.indexOf('code'),
    year = head.indexOf('year'),
    col = head.findIndex(h => column.test(h));
  if (code < 0 || year < 0 || col < 0) throw new ShapeError('Our World in Data', 'no code, year or value column');
  const out: Record<string, Yearly[]> = {};
  for (const line of lines.slice(1)) {
    // Entity names can be quoted and hold commas: read the columns from the right.
    const c = line.split(',');
    const off = c.length - head.length;
    const k = c[code + off],
      y = Number(c[year + off]),
      v = c[col + off]?.trim() ? Number(c[col + off]) : NaN;
    if (!k || !isCountry(k) || !Number.isFinite(y) || !Number.isFinite(v)) continue;
    (out[k] ||= []).push({ year: y, value: v });
  }
  Object.values(out).forEach(s => s.sort((a, b) => a.year - b.year));
  return out;
}

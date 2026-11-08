// A market card's sub line: how far a series moved in about a month.
import { describe, expect, it } from 'vitest';
import { nf1 } from '@core/format';
import { monthMove } from './markets';

const DAY = 86400e3;
const series = (...values: number[]) => values.map((value, i) => ({ t: i * 15 * DAY, value })); // every 15 days

describe('monthMove', () => {
  it('gives a percent move against the value a month before', () => {
    expect(monthMove(series(100, 100, 110), 'pct')).toBe(`+${nf1.format(10)}% in a month`);
    expect(monthMove(series(100, 100, 95), 'pct')).toBe(`−${nf1.format(5)}% in a month`);
  });
  it('gives a move in points for rates', () => {
    expect(monthMove(series(3.1, 3.2, 3.25), 'pts')).toBe('+0.15 pts in a month');
    expect(monthMove(series(3.1, 3.2, 2.9), 'pts')).toBe('−0.20 pts in a month');
  });
  it('calls a move that rounds to nothing flat, never "−0%"', () => {
    expect(monthMove(series(100, 100, 99.97), 'pct')).toBe('flat over a month');
    expect(monthMove(series(3, 3, 3.004), 'pts')).toBe('flat over a month');
  });
  it('says nothing for a series shorter than a month, or one that starts at zero', () => {
    expect(monthMove(series(100, 110), 'pct')).toBe('');
    expect(monthMove([], 'pct')).toBe('');
    expect(monthMove(series(0, 1, 2), 'pct')).toBe('');
  });
});

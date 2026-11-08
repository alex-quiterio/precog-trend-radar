// Statistics: z-scores, alert levels, momentum and the 12-step forecast.
import { describe, expect, it } from 'vitest';
import { DAY } from '@core/config';
import { computeStats, levelOf } from '@core/stats';
import type { SeriesPoint } from '@/types';

const daily = (values: number[], end = Date.UTC(2026, 10, 1)): SeriesPoint[] =>
  values.map((value, i) => ({ t: end - (values.length - 1 - i) * DAY, value }));

describe('computeStats', () => {
  const noisy = Array.from({ length: 40 }, (_, i) => 100 + (i % 2 ? 3 : -3));

  it('gives a calm series a small z-score and a 12-step forecast', () => {
    const st = computeStats(daily(noisy))!;
    expect(Math.abs(st.z!)).toBeLessThan(1.5);
    expect(st.fc).toHaveLength(12);
  });

  it('flags a spike as an alert, and maps z to levels', () => {
    const st = computeStats(daily([...noisy.slice(0, -1), 140]))!;
    expect(st.z!).toBeGreaterThan(2.5);
    expect(levelOf(st.z)).toBe('alert');
    expect(levelOf(2.0)).toBe('watch');
    expect(levelOf(1.0)).toBeNull();
  });

  it('follows the trend, keeps the forecast at or above 0, and compares with 24h earlier', () => {
    const up = computeStats(daily(Array.from({ length: 30 }, (_, i) => 50 + i * 2)))!;
    expect(up.momentum).toBeGreaterThan(0);
    expect(up.fc[11].value).toBeGreaterThan(up.latest);
    const down = computeStats(daily(Array.from({ length: 30 }, (_, i) => 60 - i * 2)))!;
    expect(down.momentum).toBeLessThan(0);
    expect(down.fc.every(f => f.value >= 0 && f.lo >= 0)).toBe(true);
    expect(down.change).toBe(-50); // 2 vs 4 the day before
  });
});

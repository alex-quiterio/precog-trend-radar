import { describe, expect, it } from 'vitest';
import { ShapeError } from '@sources/shape';
import no2 from './fixtures/no2.json';
import { parseMeasurements } from './parse';

describe('Luchtmeetnet measurements', () => {
  it('reads the hourly values, oldest first', () => {
    const series = parseMeasurements(no2);
    expect(series).toHaveLength(30);
    expect(series.at(-1)).toEqual({ t: Date.parse('2026-11-11T23:00:00Z'), value: 22.2 });
    expect(series[0].t).toBeLessThan(series[1].t);
  });
  it('skips a measurement without a time or a value', () => {
    const reply = {
      data: [
        { timestamp_measured: '2026-11-11T23:00:00+00:00', value: null },
        { timestamp_measured: 'soon', value: 4 },
        { timestamp_measured: '2026-11-11T22:00:00+00:00', value: 19.2 },
      ],
    };
    expect(parseMeasurements(reply)).toEqual([{ t: Date.parse('2026-11-11T22:00:00Z'), value: 19.2 }]);
  });
  it('refuses a reply without measurements (e.g. an error object)', () => {
    expect(() => parseMeasurements({ message: 'station not found' })).toThrow(ShapeError);
  });
});

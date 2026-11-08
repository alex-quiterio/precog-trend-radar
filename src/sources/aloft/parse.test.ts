import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ShapeError } from '@sources/shape';
import { compass, parseVpts } from './parse';

const csv = readFileSync(new URL('./fixtures/ptlis-vpts.csv', import.meta.url), 'utf8');

describe('Aloft vpts', () => {
  const d = parseVpts(csv);
  it('averages the scans in a slot into one traffic rate per hour', () => {
    expect(d.radar).toBe('ptlis');
    expect(d.day).toBe('2026-11-06');
    expect(d.hourly.map(h => new Date(h.t).getUTCHours())).toEqual([0, 1, 12, 23]);
    // the mean of the three 5-minute scans at midnight (checked by hand against the file)
    expect(d.hourly[0].value).toBeCloseTo(108.88, 1);
    expect(d.hourly[2].value).toBe(0); // midday: nothing flying
    expect(d.peak.t).toBe(Date.UTC(2026, 10, 6, 0));
  });
  it('reads where they head, how fast and how high', () => {
    expect(compass(d.heading!)).toBe('S'); // autumn: south, towards Africa
    expect(d.speedKmh).toBeGreaterThan(10);
    expect(d.speedKmh).toBeLessThan(80);
    expect(d.heightM).toBeGreaterThan(100);
    expect(d.birdsPerKm).toBeGreaterThan(0);
  });
  it('refuses a file without the columns it reads', () => {
    expect(() => parseVpts('radar,datetime\nptlis,2026-11-06T00:00:00Z')).toThrow(ShapeError);
  });
  it('names compass points', () => {
    expect([0, 200, 225, 359, -90].map(compass)).toEqual(['N', 'SSW', 'SW', 'N', 'W']);
  });
});

describe('night and day at a radar', () => {
  it('knows when the sun is up over Lisbon', async () => {
    const { sunElevation } = await import('./parse');
    expect(sunElevation(Date.UTC(2026, 10, 6, 12, 40), 38.7, -9.1)).toBeGreaterThan(25); // midday, November
    expect(sunElevation(Date.UTC(2026, 10, 6, 0), 38.7, -9.1)).toBeLessThan(-50); // midnight
    expect(sunElevation(Date.UTC(2026, 5, 21, 12), 52.4, 4.9)).toBeGreaterThan(55); // Amsterdam, midsummer
  });
});

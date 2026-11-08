import { describe, expect, it } from 'vitest';
import fireRisk from '@sources/ipma/fixtures/fire-risk.json';
import { type Daily, dryMonths, monthlyNormals, nearestFireRisk, parseLocation, summarizeYear } from './plots';

/** Daily data from a start day, with rain and temperatures picked per day. */
function days(from: string, n: number, f: (d: Date) => [number | null, number, number]): Daily {
  const out: Daily = { time: [], rain: [], tmax: [], tmin: [] };
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.parse(from) + i * 864e5);
    const [r, hi, lo] = f(d);
    out.time.push(d.toISOString().slice(0, 10));
    out.rain.push(r);
    out.tmax.push(hi);
    out.tmin.push(lo);
  }
  return out;
}

describe('reading where a plot is', () => {
  it('takes plain coordinates', () => {
    expect(parseLocation('39.61, -7.99')).toEqual({ lat: 39.61, lon: -7.99 });
    expect(parseLocation('  39.61 -7.99 ')).toEqual({ lat: 39.61, lon: -7.99 });
  });
  it('takes Google Maps links, preferring the pin to the view', () => {
    expect(parseLocation('https://www.google.com/maps/@39.6131,-7.9889,15z')).toEqual({ lat: 39.6131, lon: -7.9889 });
    expect(parseLocation('https://maps.google.com/?q=39.6,-8.1')).toEqual({ lat: 39.6, lon: -8.1 });
    expect(
      parseLocation('https://www.google.com/maps/place/Abrantes/@39.4,-8.2,13z/data=!3m1!4b1!4m6!3m5!3d39.46!4d-8.19'),
    ).toEqual({ lat: 39.46, lon: -8.19 });
  });
  it('refuses what is not a place', () => {
    expect(parseLocation('https://maps.app.goo.gl/abc123')).toBeNull();
    expect(parseLocation('Abrantes')).toBeNull();
    expect(parseLocation('95, 10')).toBeNull();
  });
});

describe('a plot’s last twelve months', () => {
  // Nov 2025 to 5 Nov 2026, then three days the archive hasn't filled yet.
  const d = days('2025-11-01', 373, x => {
    const m = x.getUTCMonth();
    const summer = m >= 5 && m <= 8;
    return [x.getTime() > Date.UTC(2026, 10, 5) ? null : summer ? 0 : 2, summer ? 37 : 15, m === 0 ? -1 : 8];
  });
  const y = summarizeYear(d)!;
  it('stops at the last day with data and counts a year back from it', () => {
    expect(y.to).toBe('2026-11-05');
    expect(y.hotDays).toBe(122); // June to September, all over 35 °C
    expect(y.frostNights).toBe(31); // January
    expect(y.months.map(m => m[0])).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]); // November 2026 isn't complete
  });
  it('counts dry months against the normal, never a summer month that is always dry', () => {
    const normals = [60, 60, 60, 60, 60, 60, 5, 5, 5, 60, 60, 60]; // Jan…Dec
    // Rain is 2 mm a day outside summer (~60 mm a month): wet months are normal; June is dry against 60 mm;
    // July to September normally get 5 mm, so they don't count.
    expect(dryMonths(y, normals)).toBe(1);
  });
  it('averages each calendar month over the years for the normal', () => {
    const n = monthlyNormals(days('2019-01-01', 365 * 2, x => [x.getUTCMonth() === 0 ? 1 : 0, 0, 0]));
    expect(n[0]).toBe(31);
    expect(n[1]).toBe(0);
  });
  it('is too short to call a year with under 300 days', () => {
    expect(summarizeYear(days('2026-01-01', 200, () => [1, 10, 5]))).toBeNull();
  });
});

describe('fire risk at a plot', () => {
  it('takes the nearest municipality within 30 km, and nothing outside Portugal', () => {
    expect(nearestFireRisk(fireRisk, { lat: 40.58, lon: -8.44 })).toBe(3); // Águeda's centre (0101)
    expect(nearestFireRisk(fireRisk, { lat: 52.37, lon: 4.9 })).toBeNull(); // Amsterdam
  });
});

// PRECOG / Trend Radar · Aloft: reading a weather radar's daily bird profiles (vpts CSV) into one day's
// migration. Each row is one height bin (200 m) of one scan: bird density (birds/km³), ground speed (m/s) and
// its direction. A slot (15 min) holds a few 5-minute scans; they are averaged, never added up. Migration is
// counted at night only (sun below the horizon at the radar): by day the echoes are mostly insects and showers.
import { ShapeError, num } from '@sources/shape';
import type { SeriesPoint } from '@/types';

/** One radar day: how many birds crossed, which way, how fast, and the traffic rate hour by hour. */
export interface MigrationDay {
  radar: string;
  /** The UTC day the file covers, e.g. "2026-11-06". */
  day: string;
  /** Birds that crossed each km of a line across their path, over the day's night hours. */
  birdsPerKm: number;
  /** The busiest night slot: its time and traffic rate (birds per km per hour). */
  peak: { t: number; mtr: number };
  /** Density-weighted means at night: heading (degrees, towards), ground speed (km/h), flight height (m). */
  heading: number | null;
  speedKmh: number | null;
  heightM: number | null;
  /** Mean traffic rate per hour, day and night (birds per km per hour), oldest first. */
  hourly: SeriesPoint[];
}

const NEED = ['radar', 'datetime', 'height', 'u', 'v', 'ff', 'dens', 'gap', 'source_file'];
const BIN_KM = 0.2;

/** A day's vpts CSV as one migration day. Throws ShapeError when the columns PRECOG reads are missing. */
export function parseVpts(csv: string): MigrationDay {
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  const head = (lines[0] || '').split(',');
  const col = Object.fromEntries(NEED.map(k => [k, head.indexOf(k)]));
  const lat = head.indexOf('radar_latitude'),
    lon = head.indexOf('radar_longitude');
  const missing = NEED.filter(k => col[k] < 0);
  if (missing.length) throw new ShapeError('Aloft', `no ${missing.join(', ')} column`);

  // scan (source file) → its slot, traffic rate and density-weighted sums
  type Scan = { slot: number; night: boolean; mtr: number; w: number; u: number; v: number; ff: number; h: number };
  const scans = new Map<string, Scan>();
  let radar = '';
  for (const line of lines.slice(1)) {
    const c = line.split(',');
    const slot = Date.parse(c[col.datetime]);
    if (!Number.isFinite(slot)) continue;
    radar ||= c[col.radar];
    const id = c[col.source_file] || c[col.datetime];
    let s = scans.get(id);
    if (!s) {
      const la = num(c[lat]),
        lo = num(c[lon]);
      const night = la == null || lo == null || sunElevation(slot, la, lo) < 0;
      s = { slot, night, mtr: 0, w: 0, u: 0, v: 0, ff: 0, h: 0 };
    }
    scans.set(id, s);
    if (c[col.gap] === 'TRUE') continue; // too few echoes in this bin to say anything
    const dens = num(c[col.dens]),
      ff = num(c[col.ff]),
      u = num(c[col.u]),
      v = num(c[col.v]),
      h = num(c[col.height]);
    if (dens == null || ff == null || dens <= 0) continue;
    s.mtr += dens * ff * 3.6 * BIN_KM; // birds/km³ × km/h × km = birds per km per hour
    if (u != null && v != null) {
      s.w += dens;
      s.u += dens * u;
      s.v += dens * v;
      s.ff += dens * ff;
      if (h != null) s.h += dens * (h + 100); // bin middle
    }
  }
  if (!scans.size) throw new ShapeError('Aloft', 'no profiles');

  const slots = new Map<number, Scan[]>();
  scans.forEach(s => slots.set(s.slot, [...(slots.get(s.slot) || []), s]));
  const times = [...slots.keys()].sort((a, b) => a - b);
  const slotMtr = times.map(t => {
    const ss = slots.get(t)!;
    return { t, night: ss[0].night, mtr: ss.reduce((a, s) => a + s.mtr, 0) / ss.length };
  });
  const nights = slotMtr.filter(s => s.night);
  const steps = times.slice(1).map((t, i) => t - times[i]);
  const stepH = (steps.sort((a, b) => a - b)[Math.floor(steps.length / 2)] || 15 * 60e3) / 3600e3;
  const birdsPerKm = nights.reduce((a, s) => a + s.mtr * stepH, 0);
  const peak = nights.reduce((a, s) => (s.mtr > a.mtr ? s : a), nights[0] ?? { t: times[0], mtr: 0 });

  const all = [...scans.values()].filter(s => s.night),
    w = all.reduce((a, s) => a + s.w, 0);
  const sum = (k: 'u' | 'v' | 'ff' | 'h') => all.reduce((a, s) => a + s[k], 0) / w;
  const heading = w > 0 ? (Math.atan2(sum('u'), sum('v')) * 180) / Math.PI : null;

  const hours = new Map<number, number[]>();
  slotMtr.forEach(s => {
    const hr = Math.floor(s.t / 3600e3) * 3600e3;
    hours.set(hr, [...(hours.get(hr) || []), s.mtr]);
  });
  const hourly = [...hours.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, v]) => ({ t, value: v.reduce((a, b) => a + b, 0) / v.length }));

  return {
    radar,
    day: new Date(times[0]).toISOString().slice(0, 10),
    birdsPerKm,
    peak: { t: peak.t, mtr: peak.mtr },
    heading: heading == null ? null : (heading + 360) % 360,
    speedKmh: w > 0 ? sum('ff') * 3.6 : null,
    heightM: w > 0 ? sum('h') : null,
    hourly,
  };
}

const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
/** A heading in degrees as a compass point, e.g. 200 → "SSW". */
export const compass = (deg: number): string => POINTS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];

/** The sun's height above the horizon (degrees) at a time and place, to within a fraction of a degree. */
export function sunElevation(t: number, lat: number, lon: number): number {
  const rad = Math.PI / 180,
    n = t / 864e5 - 10957.5; // days since 2000-01-01 12:00 UTC
  const g = (357.528 + 0.9856003 * n) * rad;
  const lambda = (280.46 + 0.9856474 * n + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const eps = (23.439 - 4e-7 * n) * rad;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const gmst = (280.46061837 + 360.98564736629 * n) * rad;
  const ha = gmst + lon * rad - ra;
  const el = Math.asin(Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(ha));
  return el / rad;
}

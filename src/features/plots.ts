// PRECOG / Trend Radar · Watch a plot: up to four pieces of land, compared side by side. For each, from its exact
// coordinates: rain over the last 12 months against its 1991–2020 normal, months under half their normal, days
// over 35 °C, frost nights, soil moisture now, elevation, and today's fire risk in its municipality (IPMA).
// Open-Meteo's reanalysis (ERA5, a ~10–25 km grid) and forecast, keyless. Plots stay in this browser.
import { reactive } from 'vue';
import { DAY, HOUR } from '@core/config';
import { errorText } from '@core/errors';
import { store } from '@core/storage';
import { getJSON } from '@sources/registry';
import { at, list, num, str } from '@sources/shape';
import { meteoColumn, meteoTimes } from '@sources/open-meteo/parse';

export const MAX_PLOTS = 4;
export interface Plot {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

// --- Reading a location ---------------------------------------------------
const pair = (a: string, b: string) => {
  const lat = Number(a),
    lon = Number(b);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat || lon)
    ? { lat, lon }
    : null;
};
const N = '(-?\\d{1,3}(?:\\.\\d+)?)';
/**
 * Coordinates from what people paste: "38.72, -9.14", "38.72 -9.14", or a Google Maps link ("@38.72,-9.14,15z",
 * "?q=38.72,-9.14", "!3d38.72!4d-9.14"). Short maps.app.goo.gl links can't be opened from the page: null.
 */
export function parseLocation(text: string): { lat: number; lon: number } | null {
  const t = text.trim();
  const tries = [
    new RegExp(`!3d${N}!4d${N}`), // the pin itself, more exact than the view's centre
    new RegExp(`@${N},${N}`),
    new RegExp(`[?&](?:q|query|ll|destination)=${N},\\s*${N}`),
    new RegExp(`^${N}\\s*[,;\\s]\\s*${N}$`),
  ];
  for (const re of tries) {
    const m = t.match(re);
    if (m) return pair(m[1], m[2]);
  }
  return null;
}

// --- The last twelve months ------------------------------------------------
export interface Daily {
  time: string[];
  rain: (number | null)[];
  tmax: (number | null)[];
  tmin: (number | null)[];
}
export interface YearSummary {
  /** The last day with data (the archive is a few days behind). */
  to: string;
  rainMm: number;
  hotDays: number;
  frostNights: number;
  /** Rain per calendar month, for the last 12 complete months: ["2025-11", mm]. */
  months: [string, number][];
}
/** The last 365 days with data, and the last 12 complete calendar months. */
export function summarizeYear(d: Daily): YearSummary | null {
  let end = d.time.length - 1;
  while (end >= 0 && d.rain[end] == null) end--;
  if (end < 300) return null; // too short to call it a year
  const start = Math.max(0, end - 364);
  let rainMm = 0,
    hotDays = 0,
    frostNights = 0;
  const byMonth = new Map<string, number>();
  for (let i = start; i <= end; i++) {
    rainMm += d.rain[i] ?? 0;
    if ((d.tmax[i] ?? -99) > 35) hotDays++;
    if ((d.tmin[i] ?? 99) < 0) frostNights++;
  }
  d.time.forEach((t, i) => {
    if (i <= end) byMonth.set(t.slice(0, 7), (byMonth.get(t.slice(0, 7)) ?? 0) + (d.rain[i] ?? 0));
  });
  // A month counts once its last day has data.
  const to = d.time[end];
  const lastDay = (ym: string) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).toISOString().slice(0, 10);
  const months = [...byMonth.entries()].filter(([ym]) => lastDay(ym) <= to).slice(-12);
  return { to, rainMm, hotDays, frostNights, months };
}

/** Mean rain per calendar month (Jan…Dec, mm) over a run of years. */
export function monthlyNormals(d: Pick<Daily, 'time' | 'rain'>): number[] {
  const sums = new Map<string, number>();
  d.time.forEach((t, i) => sums.set(t.slice(0, 7), (sums.get(t.slice(0, 7)) ?? 0) + (d.rain[i] ?? 0)));
  const by = Array.from({ length: 12 }, () => [] as number[]);
  sums.forEach((mm, ym) => by[+ym.slice(5, 7) - 1].push(mm));
  return by.map(v => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0));
}

/** Months under half their normal, counting only months that normally get 15 mm or more (not a dry July). */
export const dryMonths = (y: YearSummary, normals: number[]): number =>
  y.months.filter(([ym, mm]) => {
    const n = normals[+ym.slice(5, 7) - 1];
    return n >= 15 && mm < n / 2;
  }).length;

// --- Fire risk ------------------------------------------------------------
const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const r = Math.PI / 180,
    x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r),
    y = (b.lat - a.lat) * r;
  return Math.hypot(x, y) * 6371;
};
/** Today's fire risk (1–5) of the municipality whose centre is nearest, if one is within 30 km (so, in Portugal). */
export function nearestFireRisk(reply: unknown, p: { lat: number; lon: number }): number | null {
  let best: { d: number; rcm: number } | null = null;
  Object.values((at(reply, 'local') as Record<string, unknown>) ?? {}).forEach(m => {
    const lat = num(at(m, 'latitude')),
      lon = num(at(m, 'longitude')),
      rcm = num(at(m, 'data', 'rcm'));
    if (lat == null || lon == null || rcm == null) return;
    const d = km(p, { lat, lon });
    if (!best || d < best.d) best = { d, rcm };
  });
  const b = best as { d: number; rcm: number } | null;
  return b && b.d <= 30 ? b.rcm : null;
}
export const FIRE_WORDS = ['', 'low', 'moderate', 'high', 'very high', 'maximum'];

// --- One plot's numbers ---------------------------------------------------
export interface PlotRead {
  year?: YearSummary;
  normals?: number[];
  elevation?: number;
  soil?: { now: number; change: number };
  fire?: number | null;
  error?: string;
}
const coords = (p: Plot) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;
const archive = (p: Plot, from: string, to: string, daily: string) =>
  `https://archive-api.open-meteo.com/v1/archive?latitude=${p.lat}&longitude=${p.lon}&start_date=${from}&end_date=${to}&daily=${daily}&timezone=auto`;
const dailyOf = (j: unknown): Daily => ({
  time: meteoTimes(j, 'daily'),
  rain: meteoColumn(j, 'daily', 'precipitation_sum'),
  tmax: meteoColumn(j, 'daily', 'temperature_2m_max'),
  tmin: meteoColumn(j, 'daily', 'temperature_2m_min'),
});
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);

/** The 1991–2020 monthly normals, fetched once per spot ever (~200 KB) and kept. */
async function normalsOf(p: Plot): Promise<{ normals: number[]; elevation: number | null }> {
  const key = `precog.plotnorm.v1.${coords(p)}`;
  const hit = store.get<{ normals: number[]; elevation: number | null } | null>(key, null);
  if (hit) return hit;
  const j = await getJSON(archive(p, '1991-01-01', '2020-12-31', 'precipitation_sum'));
  const out = { normals: monthlyNormals(dailyOf(j)), elevation: num(at(j, 'elevation')) };
  store.set(key, out);
  return out;
}
/** The last year, kept for the day. */
async function yearOf(p: Plot, now: number): Promise<YearSummary | null> {
  const key = `precog.plotyear.v1.${coords(p)}`;
  const hit = store.get<{ day: string; year: YearSummary | null } | null>(key, null);
  if (hit && hit.day === ymd(now)) return hit.year;
  const j = await getJSON(
    archive(p, ymd(now - 380 * DAY), ymd(now - DAY), 'precipitation_sum,temperature_2m_max,temperature_2m_min'),
  );
  const year = summarizeYear(dailyOf(j));
  store.set(key, { day: ymd(now), year });
  return year;
}
/** Soil moisture 3–9 cm down: today's mean, and its change over 30 days. */
async function soilOf(p: Plot): Promise<{ now: number; change: number } | null> {
  const j = await getJSON(
    `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&hourly=soil_moisture_3_to_9cm&past_days=31&forecast_days=1&timezone=UTC`,
  );
  const v = meteoColumn(j, 'hourly', 'soil_moisture_3_to_9cm'),
    t = meteoTimes(j, 'hourly');
  const day = (d: string) => {
    const xs = v.filter((_, i) => t[i]?.startsWith(d)).filter((x): x is number => x != null);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const days = [...new Set(t.map(s => s.slice(0, 10)))];
  const now = day(days[days.length - 1]),
    then = day(days[days.length - 31] ?? days[0]);
  return now == null || then == null ? null : { now, change: ((now - then) / (then || 1)) * 100 };
}

// --- The store ------------------------------------------------------------
const KEY = 'precog.plots.v1';
const readPlots = (): Plot[] =>
  list(store.get<unknown>(KEY, []), 'plots').flatMap(x => {
    const lat = num(at(x, 'lat')),
      lon = num(at(x, 'lon')),
      id = str(at(x, 'id')),
      name = str(at(x, 'name'));
    return lat != null && lon != null && id ? [{ id, name: name || 'Plot', lat, lon }] : [];
  });

export function createPlots() {
  let saved: Plot[] = [];
  try {
    saved = readPlots();
  } catch {
    saved = [];
  }
  const state = reactive({ plots: saved, reads: {} as Record<string, PlotRead>, loading: false, at: 0 });
  const save = () => store.set(KEY, state.plots);
  let fire: Promise<unknown> | null = null;
  let fireAt = 0;
  const fireReply = () => {
    if (!fire || Date.now() - fireAt > 3 * HOUR) {
      fireAt = Date.now();
      fire = getJSON('https://api.ipma.pt/open-data/forecast/meteorology/rcm/rcm-d0.json').catch(() => null);
    }
    return fire;
  };
  /** Reads one plot. Each part fails on its own: a missing number never hides the others. */
  async function read(p: Plot): Promise<void> {
    const r: PlotRead = {};
    const now = Date.now();
    const [n, y, s, f] = await Promise.allSettled([normalsOf(p), yearOf(p, now), soilOf(p), fireReply()]);
    if (n.status === 'fulfilled') {
      r.normals = n.value.normals;
      if (n.value.elevation != null) r.elevation = n.value.elevation;
    }
    if (y.status === 'fulfilled' && y.value) r.year = y.value;
    if (s.status === 'fulfilled' && s.value) r.soil = s.value;
    if (f.status === 'fulfilled' && f.value) r.fire = nearestFireRisk(f.value, p);
    const failed = [n, y, s].find((x): x is PromiseRejectedResult => x.status === 'rejected');
    if (failed && !r.year) r.error = errorText(failed.reason);
    state.reads[p.id] = r;
  }
  async function load(): Promise<void> {
    state.loading = true;
    await Promise.all(state.plots.map(read));
    state.loading = false;
    state.at = Date.now();
  }
  /** Adds a plot; returns why not, or '' when it was added. */
  function add(name: string, where: string | { lat: number; lon: number }): string {
    if (state.plots.length >= MAX_PLOTS) return `Up to ${MAX_PLOTS} plots: remove one first.`;
    const loc = typeof where === 'string' ? parseLocation(where) : where;
    if (!loc)
      return /goo\.gl|maps\.app/.test(String(where))
        ? 'Short Google Maps links can’t be read here. In Google Maps, long-press the spot and copy the coordinates instead.'
        : 'Paste coordinates like 39.61, -7.99, or a Google Maps link with them.';
    const p: Plot = {
      id: Math.random().toString(36).slice(2, 9),
      name: name.trim().slice(0, 24) || `Plot ${state.plots.length + 1}`,
      lat: Math.round(loc.lat * 1e5) / 1e5,
      lon: Math.round(loc.lon * 1e5) / 1e5,
    };
    state.plots.push(p);
    save();
    void read(p);
    return '';
  }
  function remove(id: string): void {
    state.plots = state.plots.filter(p => p.id !== id);
    delete state.reads[id];
    save();
  }
  return { state, load, add, remove };
}

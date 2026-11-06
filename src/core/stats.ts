// PRECOG / Trend Radar · Pure statistics: regression forecast, momentum, z-score, alert level.
import type { AlertLevel, ForecastPoint, SeriesPoint, Stats } from '@/types';
import { BASE_N, DAY, FC_STEPS, FIT_N, HOUR, MIN_BASE, Z_ALERT, Z_WATCH } from '@core/config';

export const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / (a.length || 1);
export function sd(a: number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}
export function median(a: number[]): number {
  if (!a.length) return 0;
  const b = [...a].sort((x, y) => x - y);
  const m = b.length >> 1;
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
}
export function quantile(a: number[], q: number): number {
  if (!a.length) return 0;
  const b = [...a].sort((x, y) => x - y);
  return b[Math.min(b.length - 1, Math.floor(q * b.length))];
}

export function computeStats(s: SeriesPoint[]): Stats | null {
  const n = s.length;
  if (!n) return null;
  const v = s.map(p => p.value);
  const latest = v[n - 1],
    lt = s[n - 1].t;
  const step = n > 1 ? median(s.slice(1).map((p, i) => p.t - s[i].t)) || HOUR : HOUR;
  let ref: number | null = null;
  for (let i = n - 2; i >= 0; i--)
    if (lt - s[i].t >= DAY - 1000) {
      ref = v[i];
      break;
    }
  const change = ref ? ((latest - ref) / ref) * 100 : null;
  const m = Math.min(FIT_N, n),
    ys = v.slice(n - m);
  let slope = 0,
    icp = latest,
    sigma = 0;
  if (m >= 3) {
    const xm = (m - 1) / 2,
      ym = mean(ys);
    let num = 0,
      den = 0;
    ys.forEach((y, i) => {
      num += (i - xm) * (y - ym);
      den += (i - xm) ** 2;
    });
    slope = num / den;
    icp = ym - slope * xm;
    sigma = Math.sqrt(ys.reduce((acc, y, i) => acc + (y - (icp + slope * i)) ** 2, 0) / (m - 2));
  }
  const fc: ForecastPoint[] = [];
  for (let k = 1; k <= FC_STEPS; k++) {
    const y = icp + slope * (m - 1 + k);
    fc.push({ t: lt + k * step, value: Math.max(0, y), lo: Math.max(0, y - sigma), hi: Math.max(0, y + sigma) });
  }
  const recentMean = mean(ys);
  const momentum = recentMean > 0 ? (slope / recentMean) * 100 : 0;
  const base = v.slice(Math.max(0, n - 1 - BASE_N), n - 1);
  let z: number | null = null;
  if (base.length >= MIN_BASE) {
    const d = sd(base);
    if (d > 0) z = (latest - mean(base)) / d;
  }
  const above = fc.filter(f => f.value >= latest).length;
  return {
    latest,
    lt,
    step,
    change,
    slope,
    sigma,
    fc,
    momentum,
    z,
    baseN: base.length,
    above,
    n,
    comp: s[n - 1].comp || null,
  };
}
export const levelOf = (z: number | null | undefined): AlertLevel | null =>
  z == null ? null : z > Z_ALERT ? 'alert' : z > Z_WATCH ? 'watch' : null;
export function arrowOf(m: number): [arrow: string, word: string] {
  if (m > 1.5) return ['↑', 'rising fast'];
  if (m > 0.3) return ['↗', 'rising'];
  if (m < -1.5) return ['↓', 'falling fast'];
  if (m < -0.3) return ['↘', 'falling'];
  return ['→', 'flat'];
}

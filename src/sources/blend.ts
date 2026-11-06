// PRECOG / Trend Radar · World attention index: re-base each source to its 30-day median, weight, combine.
import { DAY, HISTORY, MIN_BASE } from '@core/config';
import { mean, median } from '@core/stats';
import type { Adapter, Entry, SeriesPoint } from '@/types';
import { ADAPTERS, utcDay } from '@sources/registry';

interface Candidate {
  pid: string;
  daily: Map<number, number>;
  ref: number;
  w: number;
  dense: boolean;
}

// --- Blend: each component re-based to 100 = its own 30-day median, then weighted ---
export function blendParts(
  E: Pick<Entry, 'parts'> & { sparse?: boolean },
  partIds: string[],
  adapters: Record<string, Pick<Adapter, 'weight' | 'minMean' | 'lagDays'>> = ADAPTERS,
): SeriesPoint[] {
  const today = utcDay();
  const cands: Candidate[] = [];
  for (const pid of partIds) {
    const pts = E.parts[pid];
    if (!pts || pts.length < MIN_BASE) continue;
    const ad = adapters[pid] ?? {};
    const daily = new Map<number, number>();
    const cutoff = today - (ad.lagDays || 0) * DAY; // drop days a source has not finished publishing
    pts.forEach(p => {
      const d = utcDay(p.t);
      if (d < cutoff) daily.set(d, p.value);
    });
    const vals = [...daily.values()];
    const win = vals.slice(-31, -1);
    const m = mean(win),
      ref = median(win) || m;
    if (!(ref > 0)) continue;
    // Sparse count sources (a few items a day) are noisy as ratios, so they get less weight.
    const density = (ad.minMean ?? 0) > 0 ? Math.min(1, m / 10) : 1;
    cands.push({ pid, daily, ref, w: (ad.weight || 1) * density, dense: m >= (ad.minMean || 0) });
  }
  // Prefer sources dense enough to trust; if none are, use what exists rather than show nothing.
  const used = cands.some(c => c.dense) ? cands.filter(c => c.dense) : cands;
  E.sparse = !cands.some(c => c.dense); // only thin sources: shown, but kept out of headline claims
  if (!used.length) return [];
  const start = Math.max(...used.map(u => Math.min(...u.daily.keys())));
  const stop = Math.min(...used.map(u => Math.max(...u.daily.keys()))); // sources publish with different lags
  const days = new Map<number, { s: number; w: number; comp: Record<string, number> }>();
  used.forEach(u =>
    u.daily.forEach((v, d) => {
      if (d < start || d > stop) return;
      const o = days.get(d) || { s: 0, w: 0, comp: {} };
      const idx = (v / u.ref) * 100;
      o.s += idx * u.w;
      o.w += u.w;
      o.comp[u.pid] = idx;
      days.set(d, o);
    }),
  );
  return [...days.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, o]) => ({ t, value: o.s / o.w, comp: o.comp }))
    .slice(-HISTORY);
}

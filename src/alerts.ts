// PRECOG / Trend Radar · Pre-cog alert rules: z-score levels, de-duplication and plain-English explanations.
import { ALERT_CAP, FC_STEPS, MIN_BASE } from '@core/config';
import { computeStats, levelOf } from '@core/stats';
import { allEntries, lensById, series, state } from '@/state';
import type { Alert, Entry, Stats } from '@/types';

/** Why a topic is running hot, in a sentence. Only called with a z-score (an alert needs one). */
export function explain(name: string, st: Stats & { z: number }): string {
  const head = `${name} attention is ${st.z.toFixed(1)}σ above its ${st.baseN}-step baseline`;
  let tail: string;
  if (st.slope > 0 && st.above >= FC_STEPS) tail = 'projected to keep rising across the full 12-step forecast';
  else if (st.slope > 0 && st.above > 0)
    tail = `projected to keep rising for ~${st.above} step${st.above > 1 ? 's' : ''}`;
  else if (st.slope > 0) tail = 'the trend is up but the spike runs ahead of it; expect a partial pullback';
  else tail = 'the underlying trend is flat or falling, so this looks like a short-lived spike';
  return `${head}; ${tail}.`;
}
export function evaluate(E: Entry, st: Stats): Alert | null {
  const z = st.z;
  if (z == null) return null;
  const level = levelOf(z);
  if (!level) return null;
  const last = E.lastAlert;
  const escalated = last && last.level === 'watch' && level === 'alert';
  if (last && st.lt - last.t < 6 * st.step && !escalated) return null;
  E.lastAlert = { t: st.lt, level };
  const lens = lensById(E.lensId);
  return {
    id: ++state.alertSeq,
    key: E.key,
    lensId: E.lensId,
    lens: lens ? lens.name : '',
    t: st.lt,
    step: st.step,
    topic: E.name,
    color: E.color,
    z,
    level,
    text: explain(E.name, { ...st, z }),
  };
}
export function scanHistory(E: Entry): Alert[] {
  const s = series(E),
    out: Alert[] = [];
  E.lastAlert = null;
  for (let i = MIN_BASE; i < s.length; i++) {
    const st = computeStats(s.slice(0, i + 1));
    const a = st && st.z != null && evaluate(E, st);
    if (a) out.push(a);
  }
  return out;
}
export function rescanAll(): void {
  state.alerts = allEntries()
    .flatMap(scanHistory)
    .sort((a, b) => b.t - a.t || b.z - a.z)
    .slice(0, ALERT_CAP);
}
export function pushAlert(a: Alert): void {
  state.alerts.unshift(a);
  state.alerts.length = Math.min(state.alerts.length, ALERT_CAP);
}

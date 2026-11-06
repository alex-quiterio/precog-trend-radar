// PRECOG / Trend Radar · Pre-cog alert rules: z-score levels, de-duplication and plain-English explanations.
import { ALERT_CAP, FC_STEPS, MIN_BASE } from '@core/config';
import { computeStats, levelOf } from '@core/stats';
import { series, type AppStore } from '@/state';
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
/** An alert for the topic at this point, or null (not hot, or already alerted recently at this level). */
export function evaluate(app: AppStore, E: Entry, st: Stats): Alert | null {
  const z = st.z;
  if (z == null) return null;
  const level = levelOf(z);
  if (!level) return null;
  const last = E.lastAlert;
  const escalated = last && last.level === 'watch' && level === 'alert';
  if (last && st.lt - last.t < 6 * st.step && !escalated) return null;
  E.lastAlert = { t: st.lt, level };
  const lens = app.lensById(E.lensId);
  return {
    id: ++app.state.alertSeq,
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
/** Every alert the topic's history would have raised, oldest first. */
export function scanHistory(app: AppStore, E: Entry): Alert[] {
  const s = series(E),
    out: Alert[] = [];
  E.lastAlert = null;
  for (let i = MIN_BASE; i < s.length; i++) {
    const st = computeStats(s.slice(0, i + 1));
    const a = st && st.z != null && evaluate(app, E, st);
    if (a) out.push(a);
  }
  return out;
}
/** Rebuilds the alert list from every topic's history, newest first. */
export function rescanAll(app: AppStore): void {
  app.state.alerts = app
    .allEntries()
    .flatMap(E => scanHistory(app, E))
    .sort((a, b) => b.t - a.t || b.z - a.z)
    .slice(0, ALERT_CAP);
}

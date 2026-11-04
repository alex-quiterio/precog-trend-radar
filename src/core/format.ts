// PRECOG / Trend Radar · Number, date and relative-time formatting.
import { DAY } from './config';

export const nf0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
export const nf1 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
export const nf2 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });
export const fmtVal = v =>
  v == null || !isFinite(v) ? '—' : (Math.abs(v) < 1 ? nf2 : Math.abs(v) < 10 ? nf1 : nf0).format(v);
export function fmtAxis(v) {
  if (v >= 1e6) return nf1.format(v / 1e6) + 'M';
  if (v >= 1e3) return nf1.format(v / 1e3) + 'k';
  return fmtVal(v);
}
export const fmtPct = p =>
  p == null || !isFinite(p) ? '—' : (p > 0 ? '+' : p < 0 ? '−' : '±') + nf1.format(Math.abs(p)) + '%';
export function fmtTime(t, step) {
  const d = new Date(t);
  return step < DAY
    ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: step >= 7 * DAY ? '2-digit' : undefined,
      });
}
export function fmtTick(t, step) {
  const d = new Date(t);
  return step < DAY
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
export const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
export function ago(t) {
  const s = (t - Date.now()) / 1000,
    a = Math.abs(s);
  if (a < 60) return 'just now';
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}
export const changeLabel = st =>
  !st ? '' : st.step >= 2 * DAY ? 'vs previous point' : st.step >= DAY ? 'vs yesterday' : 'vs 24h ago';
export const COMP_LABEL = { wikipedia: 'Wikipedia', hn: 'HN', news: 'news' };

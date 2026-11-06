// PRECOG / Trend Radar · Number, date and relative-time formatting.
import { formatDistanceStrict } from 'date-fns';
import { DAY } from '@core/config';
import type { Stats } from '@/types';

type Num = number | null | undefined;

export const nf0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
export const nf1 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
export const nf2 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });
export const fmtVal = (v: Num): string =>
  v == null || !isFinite(v) ? '—' : (Math.abs(v) < 1 ? nf2 : Math.abs(v) < 10 ? nf1 : nf0).format(v);
export function fmtAxis(v: number): string {
  if (v >= 1e6) return nf1.format(v / 1e6) + 'M';
  if (v >= 1e3) return nf1.format(v / 1e3) + 'k';
  return fmtVal(v);
}
export const fmtPct = (p: Num): string =>
  p == null || !isFinite(p) ? '—' : (p > 0 ? '+' : p < 0 ? '−' : '±') + nf1.format(Math.abs(p)) + '%';
/** Hours and minutes on a 24-hour clock ("14:05", never "2:05 PM"), whatever the phone's locale prefers. */
export const HM: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
/** "14:05". */
export const hhmm = (t: number): string => new Date(t).toLocaleTimeString(undefined, HM);
export function fmtTime(t: number, step: number): string {
  const d = new Date(t);
  return step < DAY
    ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', ...HM })
    : d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: step >= 7 * DAY ? '2-digit' : undefined,
      });
}
export function fmtTick(t: number, step: number): string {
  const d = new Date(t);
  return step < DAY ? hhmm(t) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
/**
 * "5 minutes ago", "3 days ago". Always English, like the rest of the page (the browser's own relative-time
 * format follows the phone's language). Views pass the app's minute clock (app.ui.now) as `now`, so what they
 * show refreshes as time passes.
 */
export function ago(t: number, now = Date.now()): string {
  // The clock can lag up to a minute: something fetched since its last tick is "just now", not "in 1 minute".
  const ref = Math.max(now, Math.min(t, Date.now()));
  return Math.abs(t - ref) < 60e3 ? 'just now' : formatDistanceStrict(t, ref, { addSuffix: true });
}
export const changeLabel = (st: Pick<Stats, 'step'> | null | undefined): string =>
  !st ? '' : st.step >= 2 * DAY ? 'vs previous point' : st.step >= DAY ? 'vs yesterday' : 'vs 24h ago';
export const COMP_LABEL: Record<string, string> = { wikipedia: 'Wikipedia', guardian: 'Guardian', hn: 'HN' };

// PRECOG / Trend Radar · UI state that is not derived from the data: status line, pulse, focus requests, clock.
// App data lives in reactive stores (state.ts and the feature modules); Vue tracks what each view reads.
import { reactive } from 'vue';

export const ui = reactive({
  status: '', // status line under the header
  loading: false, // a live fetch is in flight
  offline: false, // the last fetch reached no source at all
  pulse: 'starting…',
  beat: 0,
  theme: 'dark',
  watchMsg: '',
  watchErr: false,
  focusAdd: 0, // ask the lens panel to focus its "add topic" input
  swap: 0, // replay the chart's topic-switch animation
  guardian: false, // a Guardian API key is set
  guardianState: 'off' as 'off' | 'checking' | 'ok' | 'error',
  guardianNote: '', // what the Guardian button's tooltip says
  ghToken: false, // a GitHub token is set
  now: Date.now(), // a clock that ticks every minute, so "5 minutes ago" stays true
});

let clock: ReturnType<typeof setInterval> | undefined;
/** Starts the minute clock that relative times ("3 minutes ago") read. */
export function startClock(): void {
  clearInterval(clock);
  clock = setInterval(() => (ui.now = Date.now()), 60e3);
}

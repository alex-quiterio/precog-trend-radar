// PRECOG / Trend Radar · UI state that is not derived from the data: status line, pulse, theme, which API keys
// are set, focus requests, and a clock. Each app store owns one (app.ui, see state.ts); nothing shares a module copy.
import { reactive } from 'vue';

export function createUi() {
  return reactive({
    status: '', // status line under the header
    loading: false, // a live fetch is in flight
    offline: false, // the last fetch reached no source at all
    pulse: 'starting…',
    beat: 0,
    theme: 'dark' as 'dark' | 'light',
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
}
export type Ui = ReturnType<typeof createUi>;

/** Ticks ui.now every minute, so relative times ("3 minutes ago") refresh. Returns a function that stops it. */
export function startClock(ui: Ui): () => void {
  const t = setInterval(() => (ui.now = Date.now()), 60e3);
  return () => clearInterval(t);
}

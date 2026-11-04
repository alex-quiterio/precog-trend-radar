// PRECOG / Trend Radar · The bridge between plain-JS logic and Vue.
// Logic modules mutate plain state, then call bump(). Every component's render
// reads ui.v, so one bump re-renders whatever is on screen. Everything the UI
// shows that is not derived from state (status line, pulse, focus requests) lives here.
import { reactive } from 'vue';

export const ui = reactive({
  v: 0, // render version: bumped after every state change
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
});
export function bump() {
  ui.v++;
}

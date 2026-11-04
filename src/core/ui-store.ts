// PRECOG / Trend Radar · The bridge between plain-JS logic and Vue.
// Logic modules mutate plain state, then call bump(). Every component's render
// reads ui.v, so one bump re-renders whatever is on screen. Everything the UI
// shows that is not derived from state (status line, pulse, dialog requests) lives here.
import { reactive } from 'vue';

export const ui = reactive({
  v: 0, // render version: bumped after every state change
  status: '', // status line under the header
  pulse: 'starting…',
  beat: 0,
  theme: 'dark',
  watchMsg: '',
  watchErr: false,
  focusAdd: 0, // ask the lens panel to focus its "add topic" input
  swap: 0, // replay the chart's topic-switch animation
  feedsOpen: 0,
  feedsIntent: 'source',
  layout: { main: [], side: [] },
});
export function bump() {
  ui.v++;
}

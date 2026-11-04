// PRECOG / Trend Radar · Glass panel with a grip: drag (or arrow up/down on the grip) to reorder within its column.
import { LS, store } from './core/config';
import { ui } from './core/ui-store';
import { state } from './state';

export const PANELS = {
  main: ['p-brief', 'p-watch', 'p-signal', 'p-stories', 'p-table', 'p-multiples'],
  side: ['p-data', 'p-radar', 'p-alerts'],
};
export const TABLE_HIDES = ['p-signal', 'p-multiples', 'p-radar'];

export function loadLayout() {
  const saved = store.get(LS.layout, null) || {};
  Object.keys(PANELS).forEach(col => {
    const keep = (saved[col] || []).filter(id => PANELS[col].includes(id));
    PANELS[col].forEach((id, i) => {
      if (!keep.includes(id)) keep.splice(Math.min(i, keep.length), 0, id);
    });
    ui.layout[col] = keep;
  });
}
export function saveLayout() {
  store.set(LS.layout, { main: [...ui.layout.main], side: [...ui.layout.side] });
}
export const panelVisible = id => (state.tableView ? !TABLE_HIDES.includes(id) : id !== 'p-table');
export const colOf = id => Object.keys(PANELS).find(c => ui.layout[c].includes(id));

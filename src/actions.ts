// PRECOG / Trend Radar · User actions on lenses and topics: add, remove, select, switch. No DOM.
import type { TopicDef } from './types';
import { scanHistory } from './alerts';
import { ALERT_CAP, LS, MAX_LENSES, MAX_TOPICS, slotColor, store } from './core/config';
import { looksLikePerson } from './core/guard';
import { levelOf } from './core/stats';
import { bump, ui } from './core/ui-store';
import { saveLook } from './features/brief';
import { loadStories, stories } from './features/stories';
import { fetchPart, liveAbort, liveParts, setStatus, startLive } from './live';
import {
  activeLens,
  ensureEntry,
  entriesOf,
  lensById,
  saveLenses,
  savePrefs,
  selectedEntry,
  state,
  syncEntries,
} from './state';

export function watchMsg(text: string, err = false): void {
  ui.watchMsg = text || '';
  ui.watchErr = !!err;
}
export function parseTopicInput(raw: string): TopicDef {
  const [name, ...rest] = raw.split('|').map(s => s.trim());
  const def: TopicDef = { name: name.replace(/\s+/g, ' '), slot: -1 };
  rest.forEach(r => {
    const m = r.match(/^(wiki|q|query)\s*:\s*(.+)$/i);
    if (m) def[m[1].toLowerCase() === 'wiki' ? 'wiki' : 'q'] = m[2].trim();
  });
  return def;
}
export function addTopic(raw) {
  const lens = activeLens();
  if (!lens) return false;
  const def = parseTopicInput(raw);
  const name = def.name;
  if (!name) return false;
  if (name.length > 40) {
    watchMsg('Keep topic names under 40 characters.', true);
    return false;
  }
  if ([def.name, def.wiki, def.q].some(looksLikePerson)) {
    watchMsg(`“${name}” looks like a person or a handle. PRECOG tracks topics, not people.`, true);
    return false;
  }
  if (lens.topics.some(t => t.name.toLowerCase() === name.toLowerCase())) {
    watchMsg(`“${name}” is already in ${lens.name}.`, true);
    return false;
  }
  if (lens.topics.length >= MAX_TOPICS) {
    watchMsg(`A lens holds ${MAX_TOPICS} topics. Remove one, or start a new lens.`, true);
    return false;
  }
  const used = new Set(lens.topics.map(t => t.slot));
  def.slot = [...Array(MAX_TOPICS).keys()].find(i => !used.has(i));
  lens.topics.push(def);
  lens.topics.sort((a, b) => a.slot - b.slot);
  const E = ensureEntry(lens, def);
  state.selectedByLens[lens.id] = name;
  saveLenses();
  savePrefs();
  watchMsg(`Tracking “${name}” in ${lens.name}.`);
  if (state.mode === 'demo') {
    scanHistory(E).forEach(a => state.alerts.push(a));
    state.alerts.sort((a, b) => b.t - a.t);
    state.alerts.length = Math.min(state.alerts.length, ALERT_CAP);
    bump();
  } else {
    bump();
    const ctl = liveAbort && !liveAbort.signal.aborted ? liveAbort : new AbortController();
    Promise.all(liveParts().map(p => fetchPart(E, p, ctl.signal))).then(() => {
      if (E.liveError) setStatus(`No data for ${E.name}: ${E.liveError}`);
      bump();
    });
  }
  return true;
}
export function removeTopic(key) {
  const E = state.rt.get(key);
  if (!E) return;
  const lens = lensById(E.lensId);
  const i = lens.topics.findIndex(t => t.name === E.name);
  lens.topics.splice(i, 1);
  state.rt.delete(key);
  if (state.selectedByLens[lens.id] === E.name)
    state.selectedByLens[lens.id] = (lens.topics[i] || lens.topics[i - 1] || {}).name || null;
  saveLenses();
  savePrefs();
  watchMsg(`Removed “${E.name}” from ${lens.name}.`);
  bump();
}
export function addLens(raw) {
  const name = raw.trim().replace(/\s+/g, ' ').slice(0, 30);
  if (!name) return;
  if (state.lenses.length >= MAX_LENSES) {
    watchMsg(`Up to ${MAX_LENSES} lenses.`, true);
    return;
  }
  if (looksLikePerson(name)) {
    watchMsg('Lenses are themes, not people.', true);
    return;
  }
  const id = 'l' + Date.now().toString(36);
  state.lenses.push({ id, name, desc: '', topics: [] });
  state.activeLens = id;
  saveLenses();
  savePrefs();
  watchMsg(`New lens “${name}”. Add up to ${MAX_TOPICS} topics.`);
  ui.focusAdd++;
  bump();
}
export function removeLens(id) {
  const lens = lensById(id);
  if (!lens || state.lenses.length < 2) return;
  if (!confirm(`Remove the lens “${lens.name}” and its ${lens.topics.length} topics?`)) return;
  state.lenses = state.lenses.filter(l => l !== lens);
  syncEntries();
  state.activeLens = state.lenses[0].id;
  saveLenses();
  savePrefs();
  bump();
}
export function selectLens(id) {
  if (!lensById(id) || id === state.activeLens) return;
  state.activeLens = id;
  savePrefs();
  ui.swap++;
  bump();
  if (state.storyScope !== 'all') loadStories();
}
export function select(key) {
  const E = state.rt.get(key);
  if (!E) return;
  const changedLens = E.lensId !== state.activeLens;
  if (!changedLens && state.selectedByLens[E.lensId] === E.name) return;
  state.activeLens = E.lensId;
  state.selectedByLens[E.lensId] = E.name;
  savePrefs();
  ui.swap++;
  bump();
  if (state.storyScope === 'topic' || (changedLens && state.storyScope === 'lens')) loadStoriesDebounced();
}
export function shiftTopic(d) {
  const list = entriesOf(activeLens());
  if (!list.length) return;
  const i = Math.max(0, list.indexOf(selectedEntry()));
  select(list[(i + d + list.length) % list.length].key);
}
export function shiftLens(d) {
  const i = state.lenses.indexOf(activeLens());
  selectLens(state.lenses[(i + d + state.lenses.length) % state.lenses.length].id);
}
export let storyDeb = null;
export function loadStoriesDebounced() {
  clearTimeout(storyDeb);
  storyDeb = setTimeout(loadStories, 500);
}

export function lensHeat(l) {
  const ls = entriesOf(l)
    .map(E => levelOf(E.stats?.z))
    .filter(Boolean);
  const alert = ls.filter(x => x === 'alert').length;
  return alert ? { level: 'alert', n: alert } : ls.length ? { level: 'watch', n: ls.length } : null;
}
export function setStorySource(src) {
  state.storySrc = src;
  savePrefs();
  bump();
  if (!stories.at[src]) loadStories();
}
export function setStoryScope(scope) {
  state.storyScope = scope;
  savePrefs();
  bump();
  loadStories();
}
export function toggleTable() {
  state.tableView = !state.tableView;
  savePrefs();
  bump();
}
export function setIncludeNews(on) {
  state.includeNews = on;
  savePrefs();
  if (state.mode === 'live') startLive();
  else bump();
}
export function markRead() {
  saveLook();
  state.prevLook = store.get(LS.look, null);
  bump();
}
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
  ui.theme = document.documentElement.dataset.theme;
  state.rt.forEach(E => {
    E.color = slotColor(E.slot);
  });
  state.alerts.forEach(a => {
    const E = state.rt.get(a.key);
    if (E) a.color = E.color;
  });
}
export function toggleTheme() {
  applyTheme(ui.theme === 'light' ? 'dark' : 'light');
  savePrefs();
  bump();
}
export function openFeeds(intent = 'source') {
  ui.feedsIntent = intent;
  ui.feedsOpen++;
}

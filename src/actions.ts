// PRECOG / Trend Radar · User actions on lenses and topics: add, remove, select, switch. No DOM.
import type { Lens, Prefs, TopicDef } from '@/types';
import { LS, MAX_LENSES, MAX_TOPICS, slotColor, store } from '@core/config';
import { errorText } from '@core/errors';
import { looksLikePerson } from '@core/guard';
import { levelOf } from '@core/stats';
import { ui } from '@core/ui-store';
import { saveLook } from '@features/brief';
import { loadGitHub } from '@features/github';
import { loadMyGitHub } from '@features/github-me';
import { githubToken, setGithubToken } from '@sources/github/auth';
import { activeChannel } from '@/channels';
import { guardianKey, setGuardianKey } from '@sources/guardian';
import { probeSite, readingSites, saveReadingSites } from '@sources/reading';
import { loadStories, stories } from '@features/stories';
import { fetchPart, liveAbort, liveParts, setStatus, startLive } from '@/live';
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
} from '@/state';

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
export function addTopic(raw: string): boolean {
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
  def.slot = [...Array(MAX_TOPICS).keys()].find(i => !used.has(i)) ?? 0; // a free slot exists: the lens isn't full
  lens.topics.push(def);
  lens.topics.sort((a, b) => a.slot - b.slot);
  const E = ensureEntry(lens, def);
  state.selectedByLens[lens.id] = name;
  saveLenses();
  savePrefs();
  watchMsg(`Tracking “${name}” in ${lens.name}.`);
  const ctl = liveAbort?.signal.aborted === false ? liveAbort : new AbortController();
  Promise.all(liveParts().map(p => fetchPart(E, p, ctl.signal))).then(() => {
    if (E.liveError) setStatus(`No data for ${E.name}: ${E.liveError}`);
  });
  return true;
}
export function removeTopic(key: string): void {
  const E = state.rt.get(key);
  if (!E) return;
  const lens = lensById(E.lensId);
  if (!lens) return;
  const i = lens.topics.findIndex(t => t.name === E.name);
  lens.topics.splice(i, 1);
  state.rt.delete(key);
  if (state.selectedByLens[lens.id] === E.name)
    state.selectedByLens[lens.id] = (lens.topics[i] || lens.topics[i - 1])?.name ?? '';
  saveLenses();
  savePrefs();
  watchMsg(`Removed “${E.name}” from ${lens.name}.`);
}
export function addLens(raw: string): void {
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
}
export function removeLens(id: string): void {
  const lens = lensById(id);
  if (!lens || state.lenses.length < 2) return;
  if (!confirm(`Remove the lens “${lens.name}” and its ${lens.topics.length} topics?`)) return;
  state.lenses = state.lenses.filter(l => l !== lens);
  syncEntries();
  state.activeLens = state.lenses[0].id;
  saveLenses();
  savePrefs();
}
export function selectLens(id: string): void {
  if (!lensById(id) || id === state.activeLens) return;
  state.activeLens = id;
  savePrefs();
  ui.swap++;
  loadStories();
  if (activeChannel().github) loadGitHub();
}
export function select(key: string): void {
  const E = state.rt.get(key);
  if (!E) return;
  const changedLens = E.lensId !== state.activeLens;
  if (!changedLens && state.selectedByLens[E.lensId] === E.name) return;
  state.activeLens = E.lensId;
  state.selectedByLens[E.lensId] = E.name;
  savePrefs();
  ui.swap++;
  if (state.storyScope === 'topic' || changedLens) loadStoriesDebounced();
  if (changedLens && activeChannel().github) loadGitHub();
}
export function shiftTopic(d: number): void {
  const list = entriesOf(activeLens());
  if (!list.length) return;
  const sel = selectedEntry();
  const i = sel ? Math.max(0, list.indexOf(sel)) : 0;
  select(list[(i + d + list.length) % list.length].key);
}
export function shiftLens(d: number): void {
  const a = activeLens();
  const i = a ? state.lenses.indexOf(a) : 0;
  selectLens(state.lenses[(i + d + state.lenses.length) % state.lenses.length].id);
}
let storyDeb: ReturnType<typeof setTimeout> | undefined;
export function loadStoriesDebounced(): void {
  clearTimeout(storyDeb);
  storyDeb = setTimeout(loadStories, 500);
}

export function lensHeat(l: Lens | undefined): { level: 'alert' | 'watch'; n: number } | null {
  const ls = entriesOf(l)
    .map(E => levelOf(E.stats?.z))
    .filter(Boolean);
  const alert = ls.filter(x => x === 'alert').length;
  return alert ? { level: 'alert', n: alert } : ls.length ? { level: 'watch', n: ls.length } : null;
}
export function setStorySource(src: string): void {
  state.storySrc = src;
  savePrefs();
  if (!stories.at[src]) loadStories();
}
export function setStoryScope(scope: Prefs['storyScope']): void {
  state.storyScope = scope;
  savePrefs();
  loadStories();
}
export function markRead() {
  saveLook();
  state.prevLook = store.get(LS.look, null);
}
export function applyTheme(theme: string): void {
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
}
/** Asks for a Guardian API key (kept in this browser only), then refetches so news counts join the index. */
export function editGuardianKey(): void {
  const now = guardianKey();
  const k = window.prompt(
    now
      ? 'Your Guardian API key. Clear the field to stop using The Guardian.'
      : 'Paste your free Guardian API key (from open-platform.theguardian.com/access). It stays in this browser.',
    now,
  );
  if (k == null || k.trim() === now) return;
  setGuardianKey(k);
  ui.guardian = !!guardianKey();
  // Show the articles straight away, unless this channel leads with something else (e.g. its podcast).
  if (ui.guardian && !now && activeChannel().streams[0] === 'news') state.storySrc = 'news';
  savePrefs();
  startLive();
}
/** Follows a WordPress site in the Reading tab, after checking the browser may read it. */
export async function addReadingSite(raw: string): Promise<string | null> {
  try {
    const site = await probeSite(raw);
    const sites = readingSites();
    if (sites.some(x => x.url === site.url)) return `Already following ${site.name}.`;
    saveReadingSites([...sites, site]);
    loadStories();
    return null;
  } catch (e) {
    return errorText(e);
  }
}
export function removeReadingSite(url: string): void {
  saveReadingSites(readingSites().filter(x => x.url !== url));
  loadStories();
}
/** Asks for an optional GitHub token (kept in this browser only), then reloads the GitHub views faster. */
export function editGithubToken(): void {
  const now = githubToken();
  const t = window.prompt(
    now
      ? 'Your GitHub token. Clear the field to stop using it.'
      : 'Paste a GitHub token to search 3× faster. A fine-grained token with no permissions is enough: ' +
          'github.com/settings/personal-access-tokens/new. It stays in this browser.',
    now,
  );
  if (t == null || t.trim() === now) return;
  setGithubToken(t);
  ui.ghToken = !!githubToken();
  loadMyGitHub(true);
  if (activeChannel().github) loadGitHub(true);
}
/**
 * Charts a topic from anywhere (the gist's sentences, the movers table): selects it, switching to its
 * channel if it lives in another one, then brings the trend chart into view and flashes it.
 */
export function focusTopic(key: string): void {
  if (!state.rt.get(key)) return;
  select(key);
  // Let the channel re-render first; the chart element is recreated when the channel changes.
  setTimeout(() => {
    const el = document.getElementById('p-signal');
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    el.classList.remove('flash');
    void el.offsetWidth; // restart the animation
    el.classList.add('flash');
  }, 60);
}

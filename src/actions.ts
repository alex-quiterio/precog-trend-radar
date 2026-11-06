// PRECOG / Trend Radar · What the user can do: add, remove and pick topics and channels, switch streams,
// set keys, follow sites. createActions binds them to one app store and the services they start, so a test
// can give them its own; the app makes one set (context.ts). No DOM, except focusing the chart and prompts.
import type { Lens, Prefs, TopicDef } from '@/types';
import { LS, MAX_LENSES, MAX_TOPICS, slotColor, store } from '@core/config';
import { errorText } from '@core/errors';
import { looksLikePerson } from '@core/guard';
import { levelOf } from '@core/stats';
import { saveLook } from '@features/brief';
import type { GitHub } from '@features/github';
import type { MyGitHub } from '@features/github-me';
import { githubToken, setGithubToken } from '@sources/github/auth';
import { activeChannel } from '@/channels';
import { guardianKey, setGuardianKey } from '@sources/guardian';
import { probeSite, readingSites, saveReadingSites } from '@sources/reading';
import type { LiveLoop } from '@/live';
import type { AppStore } from '@/state';

/** "Name | wiki: Title | q: query" → a topic definition (its slot is picked when it's added). */
export function parseTopicInput(raw: string): TopicDef {
  const [name, ...rest] = raw.split('|').map(s => s.trim());
  const def: TopicDef = { name: name.replace(/\s+/g, ' '), slot: -1 };
  rest.forEach(r => {
    const m = r.match(/^(wiki|q|query)\s*:\s*(.+)$/i);
    if (m) def[m[1].toLowerCase() === 'wiki' ? 'wiki' : 'q'] = m[2].trim();
  });
  return def;
}
/** The services actions start: the data loop and the stream loader. */
export interface ActionDeps {
  live: Pick<LiveLoop, 'signal' | 'parts' | 'fetchPart' | 'setStatus' | 'start'>;
  stories: { load(): Promise<void>; status: { at: Record<string, number> } };
  /** The GitHub panels' loaders (optional: a test may leave them out). */
  github?: Pick<GitHub, 'load'>;
  myGithub?: Pick<MyGitHub, 'load'>;
}
export function createActions(app: AppStore, { live, stories, github, myGithub }: ActionDeps) {
  const { state, ui } = app;
  function watchMsg(text: string, err = false): void {
    ui.watchMsg = text || '';
    ui.watchErr = !!err;
  }
  function addTopic(raw: string): boolean {
    const lens = app.activeLens();
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
    const E = app.ensureEntry(lens, def);
    state.selectedByLens[lens.id] = name;
    app.saveLenses();
    app.savePrefs();
    watchMsg(`Tracking “${name}” in ${lens.name}.`);
    // Fetch the new topic now; a refresh that starts meanwhile cancels it along with everything else.
    const signal = live.signal() ?? new AbortController().signal;
    Promise.all(live.parts().map(p => live.fetchPart(E, p, signal))).then(() => {
      if (E.liveError) live.setStatus(`No data for ${E.name}: ${E.liveError}`);
    });
    return true;
  }
  function removeTopic(key: string): void {
    const E = state.rt.get(key);
    if (!E) return;
    const lens = app.lensById(E.lensId);
    if (!lens) return;
    const i = lens.topics.findIndex(t => t.name === E.name);
    lens.topics.splice(i, 1);
    state.rt.delete(key);
    if (state.selectedByLens[lens.id] === E.name)
      state.selectedByLens[lens.id] = (lens.topics[i] || lens.topics[i - 1])?.name ?? '';
    app.saveLenses();
    app.savePrefs();
    watchMsg(`Removed “${E.name}” from ${lens.name}.`);
  }
  function addLens(raw: string): void {
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
    app.saveLenses();
    app.savePrefs();
    watchMsg(`New lens “${name}”. Add up to ${MAX_TOPICS} topics.`);
    ui.focusAdd++;
  }
  function removeLens(id: string): void {
    const lens = app.lensById(id);
    if (!lens || state.lenses.length < 2) return;
    if (!confirm(`Remove the lens “${lens.name}” and its ${lens.topics.length} topics?`)) return;
    state.lenses = state.lenses.filter(l => l !== lens);
    app.syncEntries();
    state.activeLens = state.lenses[0].id;
    app.saveLenses();
    app.savePrefs();
  }
  function selectLens(id: string): void {
    if (!app.lensById(id) || id === state.activeLens) return;
    state.activeLens = id;
    app.savePrefs();
    ui.swap++;
    void stories.load();
    if (activeChannel(app).github) void github?.load();
  }
  function select(key: string): void {
    const E = state.rt.get(key);
    if (!E) return;
    const changedLens = E.lensId !== state.activeLens;
    if (!changedLens && state.selectedByLens[E.lensId] === E.name) return;
    state.activeLens = E.lensId;
    state.selectedByLens[E.lensId] = E.name;
    app.savePrefs();
    ui.swap++;
    if (state.storyScope === 'topic' || changedLens) loadStoriesDebounced();
    if (changedLens && activeChannel(app).github) void github?.load();
  }
  function shiftTopic(d: number): void {
    const list = app.entriesOf(app.activeLens());
    if (!list.length) return;
    const sel = app.selectedEntry();
    const i = sel ? Math.max(0, list.indexOf(sel)) : 0;
    select(list[(i + d + list.length) % list.length].key);
  }
  function shiftLens(d: number): void {
    const a = app.activeLens();
    const i = a ? state.lenses.indexOf(a) : 0;
    selectLens(state.lenses[(i + d + state.lenses.length) % state.lenses.length].id);
  }
  let storyDeb: ReturnType<typeof setTimeout> | undefined;
  function loadStoriesDebounced(): void {
    clearTimeout(storyDeb);
    storyDeb = setTimeout(stories.load, 500);
  }

  function lensHeat(l: Lens | undefined): { level: 'alert' | 'watch'; n: number } | null {
    const ls = app
      .entriesOf(l)
      .map(E => levelOf(E.stats?.z))
      .filter(Boolean);
    const alert = ls.filter(x => x === 'alert').length;
    return alert ? { level: 'alert', n: alert } : ls.length ? { level: 'watch', n: ls.length } : null;
  }
  function setStorySource(src: string): void {
    state.storySrc = src;
    app.savePrefs();
    if (!stories.status.at[src]) void stories.load();
  }
  function setStoryScope(scope: Prefs['storyScope']): void {
    state.storyScope = scope;
    app.savePrefs();
    void stories.load();
  }
  function markRead() {
    saveLook(app);
    state.prevLook = store.get(LS.look, null);
  }
  function applyTheme(theme: string): void {
    ui.theme = theme === 'light' ? 'light' : 'dark';
    if (typeof document !== 'undefined') document.documentElement.dataset.theme = ui.theme;
    state.rt.forEach(E => {
      E.color = slotColor(E.slot, ui.theme);
    });
    state.alerts.forEach(a => {
      const E = state.rt.get(a.key);
      if (E) a.color = E.color;
    });
  }
  /** Switches to this theme and remembers it. */
  function setTheme(theme: 'light' | 'dark'): void {
    applyTheme(theme);
    app.savePrefs();
  }
  function toggleTheme() {
    setTheme(ui.theme === 'light' ? 'dark' : 'light');
  }
  /** Asks for a Guardian API key (kept in this browser only), then refetches so news counts join the index. */
  function editGuardianKey(): void {
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
    if (ui.guardian && !now && activeChannel(app).streams[0] === 'news') state.storySrc = 'news';
    app.savePrefs();
    live.start();
  }
  /** Follows a WordPress site in the Reading tab, after checking the browser may read it. */
  async function addReadingSite(raw: string): Promise<string | null> {
    try {
      const site = await probeSite(raw);
      const sites = readingSites();
      if (sites.some(x => x.url === site.url)) return `Already following ${site.name}.`;
      saveReadingSites([...sites, site]);
      void stories.load();
      return null;
    } catch (e) {
      return errorText(e);
    }
  }
  function removeReadingSite(url: string): void {
    saveReadingSites(readingSites().filter(x => x.url !== url));
    void stories.load();
  }
  /** Asks for an optional GitHub token (kept in this browser only), then reloads the GitHub views faster. */
  function editGithubToken(): void {
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
    void myGithub?.load(true);
    if (activeChannel(app).github) void github?.load(true);
  }
  /**
   * Charts a topic from anywhere (the gist's sentences, the movers table): selects it, switching to its
   * channel if it lives in another one, then brings the trend chart into view and flashes it.
   */
  function focusTopic(key: string): void {
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
  return {
    watchMsg,
    addTopic,
    removeTopic,
    addLens,
    removeLens,
    selectLens,
    select,
    shiftTopic,
    shiftLens,
    loadStoriesDebounced,
    lensHeat,
    setStorySource,
    setStoryScope,
    markRead,
    applyTheme,
    setTheme,
    toggleTheme,
    editGuardianKey,
    addReadingSite,
    removeReadingSite,
    editGithubToken,
    focusTopic,
  };
}
export type Actions = ReturnType<typeof createActions>;

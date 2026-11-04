// PRECOG / Trend Radar · App state: lenses -> topics -> runtime entries, persistence and migrations.
import type { Alert, Entry, Lens, Prefs, SeriesPoint, TopicDef } from './types';
export interface LastLook {
  at: number;
  source: string;
  items: Record<string, { z: number | null; level: string | null; latest: number }>;
}
import { LS, MAX_LENSES, MAX_TOPICS, PRESETS, PRESET_VERSION, SLOT_ANGLE, slotColor, store } from './core/config';
import { looksLikePerson } from './core/guard';

export const state = {
  source: 'blend',
  lenses: [] as Lens[],
  activeLens: null as string | null,
  selectedByLens: {} as Record<string, string>,
  rt: new Map<string, Entry>(),
  alerts: [] as Alert[],
  alertSeq: 0,
  tableView: false,
  includeNews: true,
  storySrc: 'hn' as Prefs['storySrc'],
  storyScope: 'all' as Prefs['storyScope'],
  prevLook: null as LastLook | null,
  viewStart: Date.now(),
  liveLoaded: false,
};
export const keyOf = (lensId: string, name: string): string => `${lensId}::${name.toLowerCase()}`;
export const series = (E: Entry): SeriesPoint[] => E.liveSeries;
export const lensById = (id: string | null | undefined): Lens | undefined => state.lenses.find(l => l.id === id);
export const activeLens = (): Lens | null => lensById(state.activeLens) || state.lenses[0] || null;
export const entriesOf = (lens: Lens | null | undefined): Entry[] =>
  lens ? lens.topics.map(t => state.rt.get(keyOf(lens.id, t.name))).filter(Boolean) : [];
export const allEntries = (): Entry[] => state.lenses.flatMap(entriesOf);
export function selectedEntry(): Entry | null {
  const lens = activeLens();
  if (!lens) return null;
  const list = entriesOf(lens);
  return list.find(E => E.name === state.selectedByLens[lens.id]) || list[0] || null;
}
export function ensureEntry(lens: Lens, def: TopicDef): Entry {
  const key = keyOf(lens.id, def.name);
  let E = state.rt.get(key);
  if (!E) {
    E = {
      key,
      lensId: lens.id,
      def,
      name: def.name,
      slot: def.slot,
      color: slotColor(def.slot),
      angle: SLOT_ANGLE[def.slot],
      parts: {},
      partErr: {},
      meta: {},
      liveSeries: [],
      liveError: null,
      stats: null,
      lastAlert: null,
    };
    state.rt.set(key, E);
  }
  E.def = def;
  E.slot = def.slot;
  E.color = slotColor(def.slot);
  E.angle = SLOT_ANGLE[def.slot];
  return E;
}
export function syncEntries() {
  const keep = new Set();
  state.lenses.forEach(l =>
    l.topics.forEach(t => {
      keep.add(ensureEntry(l, t).key);
    }),
  );
  [...state.rt.keys()].forEach(k => {
    if (!keep.has(k)) state.rt.delete(k);
  });
}
export function saveLenses() {
  store.set(
    LS.lenses,
    state.lenses.map(l => ({
      id: l.id,
      name: l.name,
      desc: l.desc || '',
      lang: l.lang,
      country: l.country,
      topics: l.topics.map(({ name, slot, wiki, q }) => ({ name, slot, wiki, q })),
    })),
  );
}
export function savePrefs() {
  store.set(LS.prefs, {
    activeLens: state.activeLens,
    selectedByLens: state.selectedByLens,
    tableView: state.tableView,
    source: state.source,
    includeNews: state.includeNews,
    theme: document.documentElement.dataset.theme || 'dark',
    storySrc: state.storySrc,
    storyScope: state.storyScope,
  });
}
export function presetLenses() {
  return PRESETS.map(p => ({
    id: p.id,
    name: p.name,
    desc: p.desc,
    lang: p.lang,
    country: p.country,
    topics: p.topics.map((t, slot) => {
      const [name, o = {}] = t as [string, { wiki?: string; q?: string }?];
      return { name, slot, wiki: o.wiki, q: o.q };
    }),
  }));
}
// Topic lists shipped by earlier versions, used to tell untouched presets from customised ones.
const OLD_PRESET_TOPICS: Record<string, string[]> = {
  portugal: [
    'Portugal|Housing in Portugal|Permaculture|Regenerative agriculture|Water scarcity|Rural flight',
    'Habitação|Incêndios|Seca|Êxodo rural|Permacultura|Agricultura regenerativa',
  ],
  circular: ['Circular economy|Recycling|Plastic pollution|Producer responsibility|Waste-to-energy|Packaging waste'],
  tech: ['AI agents|WebGPU|Rust|Solid-state batteries|Remote work'],
};
export function loadLenses() {
  let lenses = store.get(LS.lenses, null);
  if (!Array.isArray(lenses) || !lenses.length) {
    lenses = presetLenses();
    const old = store.get(LS.oldWatch, null); // migrate the single watchlist from v1 into "Tech radar"
    if (Array.isArray(old) && old.length)
      lenses.find(l => l.id === 'tech').topics = old
        .filter(x => x && x.name)
        .map(x => ({ name: x.name, slot: x.slot }));
  } else if ((store.get(LS.presetVer, 1) || 1) < PRESET_VERSION) {
    // Upgrade preset lenses the user never edited, and add new presets where there's room.
    // Anything the user changed is left alone.
    const fresh = presetLenses();
    lenses = lenses.map(l => {
      const names = (l.topics || []).map(t => t.name).join('|');
      const upgrade = (OLD_PRESET_TOPICS[l.id] || []).includes(names);
      return upgrade ? fresh.find(f => f.id === l.id) : l;
    });
    fresh.forEach((f, i) => {
      if (lenses.some(l => l.id === f.id) || lenses.length >= MAX_LENSES) return;
      const after = lenses.findIndex(l => l.id === fresh[i - 1]?.id);
      lenses.splice(after + 1, 0, f);
    });
  }
  store.set(LS.presetVer, PRESET_VERSION);
  state.lenses = lenses.slice(0, MAX_LENSES).map(l => {
    const used = new Set();
    const topics = (l.topics || [])
      .filter(
        t =>
          t &&
          typeof t.name === 'string' &&
          Number.isInteger(t.slot) &&
          t.slot >= 0 &&
          t.slot < MAX_TOPICS &&
          !used.has(t.slot) &&
          !looksLikePerson(t.name) &&
          !looksLikePerson(t.wiki) &&
          !looksLikePerson(t.q) &&
          used.add(t.slot),
      )
      .slice(0, MAX_TOPICS);
    return {
      id: String(l.id),
      name: String(l.name || 'Lens'),
      desc: l.desc || '',
      lang: /^[a-z]{2,3}$/.test(l.lang || '') ? l.lang : 'en',
      country: l.country || null,
      topics,
    };
  });
  syncEntries();
}

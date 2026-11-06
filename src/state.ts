// PRECOG / Trend Radar · App state: lenses -> topics -> runtime entries, persistence and migrations.
// `state` is reactive: views re-render on their own when what they read changes. Series and stats are
// replaced whole (never edited in place) and marked raw, so hundreds of points don't each become a proxy.
import { reactive } from 'vue';
import type { Alert, Entry, Lens, Prefs, SeriesPoint, TopicDef } from '@/types';
export interface LastLook {
  at: number;
  source: string;
  items: Record<string, { z: number | null; level: string | null; latest: number }>;
}
import { LS, MAX_LENSES, MAX_TOPICS, PRESETS, PRESET_VERSION, SLOT_ANGLE, slotColor, store } from '@core/config';
import { looksLikePerson } from '@core/guard';
import { type Obj, isObj } from '@sources/shape';

export const state = reactive({
  source: 'blend',
  lenses: [] as Lens[],
  activeLens: null as string | null,
  selectedByLens: {} as Record<string, string>,
  rt: new Map<string, Entry>(),
  alerts: [] as Alert[],
  alertSeq: 0,
  storySrc: 'hn' as Prefs['storySrc'],
  storyScope: 'lens' as Prefs['storyScope'],
  prevLook: null as LastLook | null,
  viewStart: Date.now(),
  liveLoaded: false,
});
export const keyOf = (lensId: string, name: string): string => `${lensId}::${name.toLowerCase()}`;
export const series = (E: Entry): SeriesPoint[] => E.liveSeries;
export const lensById = (id: string | null | undefined): Lens | undefined => state.lenses.find(l => l.id === id);
export const activeLens = (): Lens | null => lensById(state.activeLens) || state.lenses[0] || null;
export const entriesOf = (lens: Lens | null | undefined): Entry[] =>
  lens ? lens.topics.map(t => state.rt.get(keyOf(lens.id, t.name))).filter((E): E is Entry => !!E) : [];
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
    state.rt.set(key, {
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
    });
    E = state.rt.get(key)!; // the reactive view of it, so later edits reach the screen
  }
  E.def = def;
  E.slot = def.slot;
  E.color = slotColor(def.slot);
  E.angle = SLOT_ANGLE[def.slot];
  return E;
}
export function syncEntries(): void {
  const keep = new Set<string>();
  state.lenses.forEach(l =>
    l.topics.forEach(t => {
      keep.add(ensureEntry(l, t).key);
    }),
  );
  [...state.rt.keys()].forEach(k => {
    if (!keep.has(k)) state.rt.delete(k);
  });
}
export function saveLenses(): void {
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
export function savePrefs(): void {
  store.set(LS.prefs, {
    activeLens: state.activeLens,
    selectedByLens: state.selectedByLens,
    theme: document.documentElement.dataset.theme || 'dark',
    storySrc: state.storySrc,
    storyScope: state.storyScope,
  });
}
export function presetLenses(): Lens[] {
  return PRESETS.map(p => ({
    id: p.id,
    name: p.name,
    desc: p.desc,
    lang: 'en',
    country: null,
    topics: p.topics.map((t, slot) => {
      const [name, o = {}] = t as [string, { wiki?: string; q?: string }?];
      return { name, slot, wiki: o.wiki, q: o.q };
    }),
  }));
}
// Lens ids shipped by earlier versions. When the presets change, a saved lens with one of these ids (or a
// current preset id) is an old preset and gives way; anything else is the user's own and is kept.
const OLD_PRESET_IDS = new Set([
  'world',
  'geo',
  'climate',
  'circular',
  'portugal',
  'land',
  'nl',
  'tech',
  'tgs',
  'planet',
  'amsterdam',
]);
/** A topic read back from storage, if it is usable: a name, a free slot, and nothing that names a person. */
function storedTopic(t: unknown, used: Set<number>): TopicDef | null {
  if (!isObj(t) || typeof t.name !== 'string') return null;
  const slot = t.slot;
  if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 0 || slot >= MAX_TOPICS || used.has(slot))
    return null;
  const wiki = typeof t.wiki === 'string' ? t.wiki : undefined,
    q = typeof t.q === 'string' ? t.q : undefined;
  if ([t.name, wiki, q].some(looksLikePerson)) return null;
  used.add(slot);
  return { name: t.name, slot, wiki, q };
}
/** A lens read back from storage, with its unusable topics dropped. */
function storedLens(l: Obj): Lens {
  const used = new Set<number>();
  const lang = typeof l.lang === 'string' && /^[a-z]{2,3}$/.test(l.lang) ? l.lang : 'en';
  return {
    id: String(l.id),
    name: String(l.name || 'Lens'),
    desc: typeof l.desc === 'string' ? l.desc : '',
    lang,
    country: typeof l.country === 'string' ? l.country : null,
    topics: (Array.isArray(l.topics) ? l.topics : [])
      .map(t => storedTopic(t, used))
      .filter((t): t is TopicDef => !!t)
      .slice(0, MAX_TOPICS),
  };
}
export function loadLenses(): void {
  const stored = store.get<unknown>(LS.lenses, null);
  let lenses: Obj[] = Array.isArray(stored) ? stored.filter(isObj) : [],
    upgraded = false;
  if (!lenses.length) {
    lenses = presetLenses() as unknown as Obj[];
  } else if ((store.get(LS.presetVer, 1) || 1) < PRESET_VERSION) {
    const own = lenses.filter(l => !OLD_PRESET_IDS.has(String(l.id)) && !PRESETS.some(p => p.id === l.id));
    lenses = [...(presetLenses() as unknown as Obj[]), ...own];
    upgraded = true;
  }
  store.set(LS.presetVer, PRESET_VERSION);
  state.lenses = lenses.slice(0, MAX_LENSES).map(storedLens);
  if (upgraded) saveLenses(); // persist the upgrade now, not on the next edit
  syncEntries();
}

// PRECOG / Trend Radar · The Open data panel's store: runs every registered card loader (see
// src/sources/<provider>/cards.ts) and keeps the cards, the facts the gist reads, and when they were fetched.
// Cards sit in groups: Portugal, Netherlands, Euro area, Markets, Planet. No card mixes two countries.
import { reactive } from 'vue';
import {
  CARD_LOADERS,
  loadCards,
  type CardLoader,
  type DatapointFacts,
  type DatapointGroup,
  type DatapointRow,
} from '@sources/cards';

export type { DatapointFacts, DatapointGroup, DatapointRow };
export const DATAPOINT_GROUPS: { id: DatapointGroup; label: string; hint: string }[] = [
  { id: 'pt', label: 'Portugal', hint: 'Land, air, weather, prices, jobs' },
  { id: 'nl', label: 'Netherlands', hint: 'Land, air, weather, prices, jobs' },
  { id: 'ea', label: 'Euro area', hint: 'Rates, prices, jobs' },
  { id: 'mkt', label: 'Markets', hint: 'The euro, bonds, gold, Bitcoin' },
  { id: 'planet', label: 'Planet', hint: 'The slow numbers' },
];
/** How long a loader's cards count as fresh before a channel showing them fetches them again. */
const FRESH_MS = 60 * 60e3;

/**
 * The panel's cards, and how to fetch them. The app makes one (context.ts); a test can pass its own loaders.
 * Only the loaders the channel on screen needs are run (see `cards` on each loader); the others run when a
 * channel that shows their cards opens. Cards fetched for one channel stay for the next that shows them.
 */
export function createDatapoints(loaders: CardLoader[] = CARD_LOADERS) {
  const state = reactive({
    rows: [] as DatapointRow[],
    facts: {} as DatapointFacts,
    /** Loaders that failed last time, and why: their cards are simply missing. */
    failed: [] as { id: string; error: string }[],
    at: 0,
    /** Loads still running: the panel says "Loading…" rather than "none could be loaded" meanwhile. */
    loading: 0,
  });
  /** When each loader last ran (or started running), so a channel switch doesn't fetch the same cards twice. */
  const ran = new Map<string, number>();
  /**
   * Fetches the cards with these ids (every card when left out), skipping loaders that ran in the last hour.
   * A loader that fails leaves only its own cards out, and is tried again next time.
   */
  async function load(ids?: string[]): Promise<void> {
    const now = Date.now();
    const due = loaders.filter(
      l => (!ids || l.cards.some(c => ids.includes(c))) && now - (ran.get(l.id) ?? -Infinity) >= FRESH_MS,
    );
    if (!due.length) return;
    due.forEach(l => ran.set(l.id, now));
    state.loading++;
    const { rows, facts, failed } = await loadCards(due).finally(() => state.loading--);
    failed.forEach(f => ran.delete(f.id));
    const mine = new Set(due.flatMap(l => l.cards));
    const dueIds = new Set(due.map(l => l.id));
    Object.assign(state, {
      rows: [...state.rows.filter(r => !mine.has(r.id)), ...rows].sort((a, b) => a.o - b.o),
      facts: { ...state.facts, ...facts },
      failed: [...state.failed.filter(f => !dueIds.has(f.id)), ...failed],
      at: Date.now(),
    });
  }
  return { state, load };
}
export type Datapoints = ReturnType<typeof createDatapoints>;

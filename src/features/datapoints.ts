// PRECOG / Trend Radar · The Open data panel's store: runs every registered card loader (see
// src/sources/<provider>/cards.ts) and keeps the cards, the facts the gist reads, and when they were fetched.
// Cards sit in groups: Portugal, Netherlands, Euro area, Markets, Planet. No card mixes two countries.
import { reactive } from 'vue';
import {
  loadCards,
  type CardLoader,
  type DatapointFacts,
  type DatapointGroup,
  type DatapointRow,
} from '@sources/cards';

export type { DatapointFacts, DatapointGroup, DatapointRow };
export const DATAPOINT_GROUPS: { id: DatapointGroup; label: string; hint: string }[] = [
  { id: 'pt', label: 'Portugal', hint: 'Land, weather, prices, jobs' },
  { id: 'nl', label: 'Netherlands', hint: 'Land, weather, prices, jobs' },
  { id: 'ea', label: 'Euro area', hint: 'Rates, prices, jobs' },
  { id: 'mkt', label: 'Markets', hint: 'The euro, bonds, gold, Bitcoin' },
  { id: 'planet', label: 'Planet', hint: 'The slow numbers' },
];
/** The panel's cards, and how to fetch them. The app makes one (context.ts); a test can pass its own loaders. */
export function createDatapoints(loaders?: CardLoader[]) {
  const state = reactive({
    rows: [] as DatapointRow[],
    facts: {} as DatapointFacts,
    /** Loaders that failed last time, and why: their cards are simply missing. */
    failed: [] as { id: string; error: string }[],
    at: 0,
  });
  /** Fetches every card. Hourly; a loader that fails leaves only its own cards out. */
  async function load(): Promise<void> {
    const { rows, facts, failed } = await loadCards(loaders);
    Object.assign(state, { rows, facts, failed, at: Date.now() });
  }
  return { state, load };
}
export type Datapoints = ReturnType<typeof createDatapoints>;

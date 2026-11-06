// PRECOG / Trend Radar · The Open data panel's store: runs every registered card loader (see
// src/sources/<provider>/cards.ts) and keeps the cards, the facts the gist reads, and when they were fetched.
// Cards sit in groups by place: Portugal, Netherlands, Euro area, Planet. No card mixes two countries.
import { reactive } from 'vue';
import { loadCards, type DatapointFacts, type DatapointGroup, type DatapointRow } from '@sources/cards';

export type { DatapointFacts, DatapointGroup, DatapointRow };
export const DATAPOINT_GROUPS: { id: DatapointGroup; label: string; hint: string }[] = [
  { id: 'pt', label: 'Portugal', hint: 'Land, weather, prices, jobs' },
  { id: 'nl', label: 'Netherlands', hint: 'Land, weather, prices, jobs' },
  { id: 'ea', label: 'Euro area', hint: 'Rates, prices, jobs' },
  { id: 'planet', label: 'Planet', hint: 'The slow numbers' },
];
export const dp = reactive({
  rows: [] as DatapointRow[],
  facts: {} as DatapointFacts,
  /** Loaders that failed last time, and why: their cards are simply missing. */
  failed: [] as { id: string; error: string }[],
  at: 0,
});
/** Fetches every card. Hourly; a loader that fails leaves only its own cards out. */
export async function loadDatapoints(): Promise<void> {
  const { rows, facts, failed } = await loadCards();
  Object.assign(dp, { rows, facts, failed, at: Date.now() });
}

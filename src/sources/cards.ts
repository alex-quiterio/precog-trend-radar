// PRECOG / Trend Radar · Open-data cards: the shapes, and the registry each provider adds its loaders to
// (see src/sources/<provider>/cards.ts). The Open data panel shows whichever cards a channel picks by id.
import type { SeriesPoint } from '@/types';
import { errorText } from '@core/errors';

/** Which heading a card sits under in the panel. No card mixes two countries. */
export type DatapointGroup = 'pt' | 'nl' | 'ea' | 'mkt' | 'planet';
export interface DatapointRow {
  /** Stable id a channel picks the card by (see channels.ts). */
  id: string;
  /** Which section of the panel the card sits in. */
  group: DatapointGroup;
  /** The label, e.g. "ECB deposit rate". */
  k: string;
  /** The value, formatted, e.g. "2.5%". */
  v: string;
  /** A line under the value, e.g. "+0.2 pts in a year". */
  sub?: string;
  /** Where the number comes from, and how fresh it is. */
  src: string;
  href: string;
  /** Order within the group (lower first). */
  o: number;
  /** Optional history for a small chart, oldest first. */
  spark?: SeriesPoint[];
}
/** Numbers the gist reads as well as the cards (fire risk and weather warnings in Portugal). */
export interface DatapointFacts {
  fire?: { hi: number; max: number; n: number };
  warnings?: { red: number; orange: number; yellow: number; types: string };
}
/** One request's worth of cards. A provider registers one loader per request, so they fail independently. */
export interface CardLoader {
  /** Unique, e.g. 'eurostat-unemployment'. */
  id: string;
  /** Fetch and build the cards: a list of them, or the cards plus facts for the gist. */
  load(): Promise<DatapointRow[] | { rows: DatapointRow[]; facts: DatapointFacts }>;
}

export const CARD_LOADERS: CardLoader[] = [];
/** Adds a loader. Its cards appear wherever a channel lists their ids. */
export function registerCards(loader: CardLoader): void {
  if (CARD_LOADERS.some(l => l.id === loader.id)) throw new Error(`Card loader “${loader.id}” is registered twice`);
  CARD_LOADERS.push(loader);
}
/** Runs loaders side by side. One failing never blocks the others; its id and error come back in `failed`. */
export async function loadCards(loaders: CardLoader[] = CARD_LOADERS): Promise<{
  rows: DatapointRow[];
  facts: DatapointFacts;
  failed: { id: string; error: string }[];
}> {
  const rows: DatapointRow[] = [],
    facts: DatapointFacts = {},
    failed: { id: string; error: string }[] = [];
  await Promise.all(
    loaders.map(async l => {
      try {
        const out = await l.load();
        if (Array.isArray(out)) rows.push(...out);
        else {
          rows.push(...out.rows);
          Object.assign(facts, out.facts);
        }
      } catch (e) {
        failed.push({ id: l.id, error: errorText(e) });
      }
    }),
  );
  return { rows: rows.sort((a, b) => a.o - b.o), facts, failed };
}

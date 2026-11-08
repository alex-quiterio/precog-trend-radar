// PRECOG / Trend Radar · iNaturalist: reading the species-counts reply (how many observations of each species).
import { at, list, num, str } from '@sources/shape';

/** A species and how many times people recorded it. */
export interface SpeciesCount {
  id: number;
  /** Scientific name, e.g. "Sylvia atricapilla". */
  name: string;
  /** English name, e.g. "Eurasian Blackcap" (the scientific name when there is none). */
  common: string;
  count: number;
}

/** species_counts as a list, best first. Records without an id or a count are skipped. */
export function parseSpeciesCounts(reply: unknown): SpeciesCount[] {
  return list(at(reply, 'results'), 'iNaturalist', 'results').flatMap(r => {
    const id = num(at(r, 'taxon', 'id')),
      count = num(at(r, 'count')),
      name = str(at(r, 'taxon', 'name'));
    if (id == null || count == null || !name) return [];
    const common = str(at(r, 'taxon', 'preferred_common_name')) || name;
    return [{ id, name, common, count }];
  });
}

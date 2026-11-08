import { describe, expect, it } from 'vitest';
import counts from './fixtures/species-counts.json';
import { parseSpeciesCounts } from './parse';

describe('iNaturalist species counts', () => {
  it('reads each species with its English name and count', () => {
    const s = parseSpeciesCounts(counts);
    expect(s).toHaveLength(4);
    expect(s[0]).toEqual({ id: 15282, name: 'Sylvia atricapilla', common: 'Eurasian Blackcap', count: 16 });
  });
  it('falls back to the scientific name and skips broken records', () => {
    const reply = {
      results: [
        { count: 2, taxon: { id: 1, name: 'Aves sp.' } },
        { count: 3, taxon: {} },
      ],
    };
    expect(parseSpeciesCounts(reply)).toEqual([{ id: 1, name: 'Aves sp.', common: 'Aves sp.', count: 2 }]);
  });
});

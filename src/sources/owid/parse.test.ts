import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ShapeError } from '@sources/shape';
import { parseHappiness } from './parse';

const csv = readFileSync(new URL('./fixtures/happiness.csv', import.meta.url), 'utf8');

describe('World Happiness Report scores (Our World in Data)', () => {
  const h = parseHappiness(csv);
  it('keeps each country’s latest year, ranked among the countries scored that year', () => {
    expect(h.FIN).toEqual({ name: 'Finland', year: 2025, score: 7.764, rank: 1, of: 7 });
    expect(h.NLD).toEqual({ name: 'Netherlands', year: 2025, score: 7.223, rank: 2, of: 7 });
    expect(h.AFG.rank).toBe(7);
  });
  it('leaves out regions and the world', () => {
    expect(h.OWID_WRL).toBeUndefined();
  });
  it('reads entity names that hold a comma', () => {
    const quoted = 'entity,code,year,cantril_ladder_score\n"Korea, South",KOR,2025,6.1\n';
    expect(parseHappiness(quoted).KOR).toEqual({ name: 'Korea, South', year: 2025, score: 6.1, rank: 1, of: 1 });
  });
  it('refuses a file without a score column', () => {
    expect(() => parseHappiness('entity,code,year\nX,XXX,2025')).toThrow(ShapeError);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ShapeError } from '@sources/shape';
import { parseHappiness, parseYearly } from './parse';

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

describe('a yearly column (Our World in Data)', () => {
  const loss = readFileSync(new URL('./fixtures/tree-cover-loss.csv', import.meta.url), 'utf8');
  it('reads each country’s series, oldest first', () => {
    const data = parseYearly(loss, /tree_cover_loss/);
    expect(Object.keys(data).sort()).toEqual(['NLD', 'PRT']);
    expect(data.PRT[0]).toEqual({ year: 2001, value: 24361.623 });
    expect(data.PRT.at(-1)).toEqual({ year: 2024, value: 43375.285 });
  });
  it('leaves out the world, and rows without a number', () => {
    const csv = 'entity,code,year,loss_ha\nWorld,OWID_WRL,2024,5\nPortugal,PRT,2023,\nPortugal,PRT,2024,7\n';
    expect(parseYearly(csv, /loss/)).toEqual({ PRT: [{ year: 2024, value: 7 }] });
  });
  it('reads entity names that hold a comma', () => {
    expect(parseYearly('entity,code,year,loss_ha\n"Korea, South",KOR,2024,3\n', /loss/).KOR).toEqual([
      { year: 2024, value: 3 },
    ]);
  });
  it('refuses a file without the column asked for', () => {
    expect(() => parseYearly(loss, /happiness/)).toThrow(ShapeError);
  });
});

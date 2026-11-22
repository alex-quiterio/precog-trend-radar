// Climate TRACE replies: country emissions (all sectors, and forests and land) and the largest asset.
import { describe, expect, it } from 'vitest';
import assets from './fixtures/assets-nld.json';
import countries from './fixtures/country-emissions.json';
import land from './fixtures/land-2017.json';
import {
  parseCountryEmissions,
  parseTopAsset,
} from './parse';

describe('Climate TRACE replies', () => {
  it('reads each country’s emissions, rank and the world’s total', () => {
    const rows = parseCountryEmissions(countries);
    const pt = rows.find(r => r.country === 'PRT')!;
    expect(pt.rank).toBe(72);
    expect(pt.co2e / 1e6).toBeCloseTo(71.0, 0);
    expect(pt.world! / 1e9).toBeCloseTo(57.65, 1);
    expect(rows.map(r => r.country).sort()).toEqual([
      'NLD',
      'PRT',
    ]);
  });
  it('keeps a sink as a negative number, and a fire year as a positive one', () => {
    const pt = parseCountryEmissions(land).find(
      r => r.country === 'PRT',
    )!;
    expect(pt.co2e / 1e6).toBeCloseTo(80.7, 0); // 2017: the fires released more than the land took up
    expect(
      parseCountryEmissions(land).find(
        r => r.country === 'NLD',
      )!.co2e,
    ).toBeGreaterThan(0);
  });
  it('skips a country without a total instead of failing', () => {
    expect(
      parseCountryEmissions([
        { country: 'PRT', emissions: {} },
        ...countries,
      ]),
    ).toHaveLength(2);
  });
  it('refuses a reply that is not a list of countries', () => {
    expect(() =>
      parseCountryEmissions({ error: 'bad request' }),
    ).toThrow(/unexpected format/);
  });
  it('reads the largest asset, with its sector and CO₂e', () => {
    expect(parseTopAsset(assets)).toEqual({
      name: 'Amsterdam Airport Schiphol',
      sector: 'international-aviation',
      co2e: expect.closeTo(9917391.35, 0),
    });
  });
  it('gives null when there are no assets, and refuses a reply without the list', () => {
    expect(parseTopAsset({ assets: [] })).toBeNull();
    expect(() => parseTopAsset({ bbox: [] })).toThrow(
      /unexpected format/,
    );
  });
});

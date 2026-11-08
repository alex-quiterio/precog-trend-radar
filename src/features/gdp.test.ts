import { describe, expect, it } from 'vitest';
import { parseIndicator } from '@sources/worldbank/parse';
import gdp from '@sources/worldbank/fixtures/gdp.json';
import { homeEconomies, topEconomies, usd } from './gdp';

describe('the largest economies', () => {
  it('ranks by the latest year, with the change over five years', () => {
    const top = topEconomies(parseIndicator(gdp));
    expect(top.map(e => e.name)).toEqual(['United States', 'China', 'Germany']);
    expect(top[0].year).toBe(2025);
    expect(top[1].change5).toBeGreaterThan(0);
  });
  it('keeps seven, and only countries (never a region the API might add)', () => {
    const data = Object.fromEntries(
      ['USA', 'CHN', 'DEU', 'JPN', 'IND', 'GBR', 'FRA', 'ITA', 'WLD'].map((iso, i) => [
        iso,
        [{ year: 2025, value: 100 - i }],
      ]),
    );
    const top = topEconomies(data);
    expect(top).toHaveLength(7);
    expect(top.map(e => e.iso)).not.toContain('WLD');
    expect(top[6].iso).toBe('FRA');
  });
  it('never puts the Netherlands or Portugal in the top seven, and lists them below', () => {
    const data = parseIndicator(gdp);
    expect(topEconomies(data).map(e => e.iso)).not.toContain('NLD');
    const home = homeEconomies(data);
    expect(home.map(e => e.name)).toEqual(['Netherlands', 'Portugal']);
    expect(usd(home[1].value)).toBe('$347B');
    expect(home[1].change5).toBeGreaterThan(40);
  });
  it('writes dollars in trillions or billions', () => {
    expect([usd(30.77e12), usd(4.44e12), usd(950e9)]).toEqual(['$30.8T', '$4.44T', '$950B']);
  });
});

describe('the happiest countries', () => {
  it('takes the top three by rank, with GDP when the World Bank has it', async () => {
    const { happiestEconomies } = await import('./gdp');
    const happy = {
      FIN: { name: 'Finland', year: 2025, score: 7.76, rank: 1, of: 147 },
      DNK: { name: 'Denmark', year: 2025, score: 7.54, rank: 3, of: 147 },
      ISL: { name: 'Iceland', year: 2025, score: 7.54, rank: 2, of: 147 },
      NLD: { name: 'Netherlands', year: 2025, score: 7.22, rank: 9, of: 147 },
    };
    const rows = happiestEconomies({ FIN: [{ year: 2025, value: 3e11 }] }, happy);
    expect(rows.map(r => r.name)).toEqual(['Finland', 'Iceland', 'Denmark']);
    expect(rows[0].value).toBe(3e11);
    expect(rows[1]).toMatchObject({ value: null, year: null });
  });
});

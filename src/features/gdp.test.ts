import { describe, expect, it } from 'vitest';
import { parseIndicator } from '@sources/worldbank/parse';
import gdp from '@sources/worldbank/fixtures/gdp.json';
import { topEconomies, usd } from './gdp';

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
  it('writes dollars in trillions or billions', () => {
    expect([usd(30.77e12), usd(4.44e12), usd(950e9)]).toEqual(['$30.8T', '$4.44T', '$950B']);
  });
});

import { describe, expect, it } from 'vitest';
import { ShapeError } from '@sources/shape';
import gdp from './fixtures/gdp.json';
import { parseIndicator } from './parse';

describe('World Bank indicator replies', () => {
  it('reads yearly values per country, oldest first', () => {
    const data = parseIndicator(gdp);
    expect(Object.keys(data).sort()).toEqual(['CHN', 'DEU', 'USA']);
    expect(data.CHN[0].year).toBe(2019);
    expect(data.CHN.at(-1)).toEqual({ year: 2025, value: 19498039388042.6 });
  });
  it('skips years without a value', () => {
    const reply = [
      {},
      [
        { countryiso3code: 'PRT', date: '2025', value: null },
        { countryiso3code: 'PRT', date: '2024', value: 3 },
      ],
    ];
    expect(parseIndicator(reply)).toEqual({ PRT: [{ year: 2024, value: 3 }] });
  });
  it('turns an error reply into a ShapeError', () => {
    expect(() => parseIndicator([{ message: [{ value: 'Invalid value' }] }])).toThrow(ShapeError);
  });
});

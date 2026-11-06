import { describe, expect, it } from 'vitest';
import deposit from './fixtures/deposit-rate.json';
import mortgages from './fixtures/mortgage-rates.json';
import { parseEcbLatest, parseEcbSeries } from './parse';

describe('ECB replies', () => {
  it('reads the latest deposit rate and the day it took effect', () => {
    expect(parseEcbLatest(deposit)).toEqual({ value: 2.5, since: '2026-09-16' });
  });
  it('reads one series per country, oldest first', () => {
    const byArea = parseEcbSeries(mortgages, 1);
    expect([...byArea.keys()]).toEqual(['NL', 'PT', 'U2']);
    expect(byArea.get('PT')).toEqual([
      { t: Date.UTC(2026, 6, 1), value: 2.97 },
      { t: Date.UTC(2026, 7, 1), value: 3.01 },
      { t: Date.UTC(2026, 8, 1), value: 3.06 },
    ]);
  });
  it('refuses a reply without an observation', () => {
    expect(() => parseEcbLatest({ dataSets: [] })).toThrow(/no observation/);
  });
});

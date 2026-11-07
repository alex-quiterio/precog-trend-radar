import { describe, expect, it } from 'vitest';
import deposit from './fixtures/deposit-rate.json';
import mortgages from './fixtures/mortgage-rates.json';
import fx from './fixtures/fx-rates.json';
import bond from './fixtures/bond-yield.json';
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
  it('reads daily exchange rates, one series per currency', () => {
    const byCurrency = parseEcbSeries(fx, 1);
    expect([...byCurrency.keys()]).toEqual(['CHF', 'CNY', 'GBP', 'JPY', 'USD']);
    expect(byCurrency.get('USD')).toEqual([
      { t: Date.UTC(2026, 10, 4), value: 1.1267 },
      { t: Date.UTC(2026, 10, 5), value: 1.1224 },
      { t: Date.UTC(2026, 10, 6), value: 1.1165 },
    ]);
  });
  it('reads the daily 10-year yield', () => {
    const [series] = [...parseEcbSeries(bond, 0).values()];
    expect(series).toHaveLength(3);
    expect(series[2]).toEqual({ t: Date.UTC(2026, 10, 5), value: 3.2938441917 });
  });
  it('refuses a reply without an observation', () => {
    expect(() => parseEcbLatest({ dataSets: [] })).toThrow(/no observation/);
  });
});

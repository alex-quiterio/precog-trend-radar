import { describe, expect, it } from 'vitest';
import spot from './fixtures/spot.json';
import { parseSpotPrices } from './parse';

describe('EIA replies', () => {
  it('reads Brent and WTI spot prices, oldest first', () => {
    const byId = parseSpotPrices(spot);
    expect([...byId.keys()].sort()).toEqual(['RBRTE', 'RWTC']);
    expect(byId.get('RBRTE')).toEqual([
      { t: Date.UTC(2026, 9, 30), value: 120.15 },
      { t: Date.UTC(2026, 10, 2), value: 107.39 },
      { t: Date.UTC(2026, 10, 3), value: 107.03 },
    ]);
  });
  it('skips a row without a price, and refuses an error reply', () => {
    const reply = { response: { data: [{ period: '2026-11-03', series: 'RBRTE', value: null }] } };
    expect(parseSpotPrices(reply).size).toBe(0);
    expect(() => parseSpotPrices({ error: 'invalid api_key' })).toThrow(/unexpected format/);
  });
});

import { describe, expect, it } from 'vitest';
import markets from './fixtures/search-markets.json';
import { parseMarkets } from './parse';

const NOW = Date.UTC(2026, 10, 6);

describe('Manifold replies', () => {
  it('keeps open markets with 10+ forecasters whose question names no person', () => {
    const list = parseMarkets(markets, NOW);
    // Dropped: 3 forecasters ("Stop climate shakedowns act") and a named person (Bryan Caplan).
    expect(list.map(f => f.bettors)).toEqual([122, 20, 155, 32]);
    expect(list[0]).toMatchObject({ id: 'mf:vZHLcguyXmZDnNlhPQ68', vol24: 400 });
    expect(list[0].prob).toBeCloseTo(0.197, 3);
  });
  it('drops markets that already closed', () => {
    expect(parseMarkets(markets, 2600000000000)).toEqual([]);
  });
  it('refuses a reply that is not a list', () => {
    expect(() => parseMarkets({ error: 'rate limited' }, NOW)).toThrow(/unexpected format/);
  });
});

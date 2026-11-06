import { describe, expect, it } from 'vitest';
import unemployment from './fixtures/unemployment.json';
import housePrices from './fixtures/house-prices.json';
import { parseEurostat } from './parse';

describe('Eurostat JSON-stat replies', () => {
  it('reads one country out of a multi-country reply, skipping months not yet published', () => {
    // October has no value yet in this reply: it is skipped, not read as 0.
    expect(parseEurostat(unemployment, { geo: 'PT' })).toEqual([
      { t: Date.UTC(2026, 7, 1), value: 5.6 },
      { t: Date.UTC(2026, 8, 1), value: 5.6 },
    ]);
    expect(parseEurostat(unemployment, { geo: 'NL' }).map(p => p.value)).toEqual([4, 4]);
  });
  it('reads quarters as their first day', () => {
    expect(parseEurostat(housePrices, { geo: 'PT' })).toEqual([
      { t: Date.UTC(2026, 0, 1), value: 17.8 },
      { t: Date.UTC(2026, 3, 1), value: 16.5 },
    ]);
  });
  it('gives nothing for a country the reply does not have', () => {
    expect(parseEurostat(unemployment, { geo: 'ES' })).toEqual([]);
  });
  it('refuses a reply that is not JSON-stat', () => {
    expect(() => parseEurostat({ error: { status: 400 } }, { geo: 'PT' })).toThrow(/unexpected format/);
  });
});

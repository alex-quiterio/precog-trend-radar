// BIS replies: the long consumer-price series, one per economy, from a saved reply.
import { describe, expect, it } from 'vitest';
import cpi from './fixtures/cpi.json';
import { parseBisSeries } from './parse';

describe('BIS replies', () => {
  it('reads each economy’s monthly series, oldest first', () => {
    const all = parseBisSeries(cpi);
    expect(Object.keys(all).sort()).toEqual([
      'CN',
      'IN',
      'JP',
      'US',
      'XM',
    ]);
    expect(all.JP).toHaveLength(13);
    expect(all.JP.at(-1)).toEqual({
      t: Date.UTC(2026, 8, 1),
      value: 2.097902,
    });
    expect(all.JP[0].t).toBeLessThan(all.JP[12].t);
  });
  it('skips a month without a number: no US figure for October 2025, when the shutdown stopped the BLS', () => {
    const us = parseBisSeries(cpi).US;
    expect(us).toHaveLength(12);
    expect(us.map(p => p.t)).not.toContain(
      Date.UTC(2025, 9, 1),
    );
  });
  it('refuses a reply without series', () => {
    expect(() => parseBisSeries({ error: 'nope' })).toThrow(
      /unexpected format/,
    );
  });
});

import { describe, expect, it } from 'vitest';
import energyzero from './fixtures/energyzero.json';
import ree from './fixtures/ree-spot.json';
import { cheapCard } from './cards';
import { cheapestBlock, parseEnergyZero, parseReeSpot } from './parse';

const at = (h: number) => Date.UTC(2026, 10, 8, h);

describe('day-ahead power prices', () => {
  it('reads EnergyZero as hourly € a kWh', () => {
    const p = parseEnergyZero(energyzero);
    expect(p).toHaveLength(23);
    expect(p[0]).toEqual({ t: at(0), eurKwh: 0.226077497 });
  });
  it('averages REE’s quarter hours into hours, in € a kWh', () => {
    const p = parseReeSpot(ree);
    expect(p).toHaveLength(24);
    expect(p[0].t).toBe(at(-1)); // 00:00 in Madrid is 23:00 UTC
    expect(p[0].eurKwh).toBeGreaterThan(0.05);
    expect(p[0].eurKwh).toBeLessThan(0.5);
  });
  it('finds the cheapest block of back-to-back hours from a given hour', () => {
    const prices = [5, 4, 1, 1, 1, 9, 2, 2, 2].map((c, i) => ({ t: at(i), eurKwh: c / 100 }));
    expect(cheapestBlock(prices, 3)).toEqual({ start: at(2), end: at(5), avg: 0.01 });
    expect(cheapestBlock(prices, 3, at(4))).toEqual({ start: at(6), end: at(9), avg: 0.02 });
    expect(cheapestBlock(prices.slice(0, 2), 3)).toBeNull();
  });
  it('never joins hours across a gap in the data', () => {
    const prices = [
      { t: at(0), eurKwh: 0.01 },
      { t: at(1), eurKwh: 0.01 },
      { t: at(5), eurKwh: 0.01 },
      { t: at(6), eurKwh: 0.5 },
      { t: at(7), eurKwh: 0.5 },
    ];
    expect(cheapestBlock(prices, 3)?.start).toBe(at(5));
  });
  it('names the hours in local time, today or tomorrow, against the average ahead', () => {
    const prices = [3, 3, 1, 1, 1, 3].map((c, i) => ({ t: at(21 + i), eurKwh: c / 10 }));
    const card = cheapCard(
      { id: 'power-nl', group: 'nl', tz: 'Europe/Amsterdam', src: 'EnergyZero', href: '' },
      prices,
      at(21) + 10 * 60e3,
    )!;
    expect(card.v).toBe('tomorrow 00:00–03:00'); // 23:00 UTC is midnight in Amsterdam
    expect(card.sub).toMatch(/^10 c\/kWh, against 20 c\/kWh on average/);
    expect(card.spark).toHaveLength(6);
    // Nothing left ahead: no card, rather than a stale one.
    expect(cheapCard({ id: 'x', group: 'nl', tz: 'UTC', src: '', href: '' }, prices, at(31))).toBeNull();
  });
});

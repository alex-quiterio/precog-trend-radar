import { describe, expect, it } from 'vitest';
import fng from './fixtures/fng.json';
import { parseFearGreed } from './parse';

describe('Fear & Greed replies', () => {
  it('reads daily readings oldest first, and the latest label', () => {
    const f = parseFearGreed(fng);
    expect(f.label).toBe('Extreme Fear');
    expect(f.series).toHaveLength(8);
    expect(f.series[7]).toEqual({ t: 1794009600000, value: 25 });
    expect(f.series[0].t).toBeLessThan(f.series[7].t);
  });
  it('refuses a reply without data', () => {
    expect(() => parseFearGreed({ metadata: { error: 'x' } })).toThrow(/unexpected format/);
  });
});

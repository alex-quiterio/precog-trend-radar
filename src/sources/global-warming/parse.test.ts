import { describe, expect, it } from 'vitest';
import co2 from './fixtures/co2.json';
import seaIce from './fixtures/sea-ice.json';
import { parseCo2, parseSeaIce } from './parse';

describe('global-warming.org replies', () => {
  it('reads the CO₂ trend as daily points', () => {
    const points = parseCo2(co2);
    expect(points).toHaveLength(5);
    expect(points[4]).toEqual({ t: Date.UTC(2026, 10, 4), value: 428.23 });
  });
  it('reads sea-ice months in order, with their anomaly', () => {
    const months = parseSeaIce(seaIce);
    expect(months.map(m => m.month)).toEqual(['202606', '202607', '202608', '202609']);
    expect(months[3]).toEqual({ month: '202609', value: 22.13, anom: -2.07 });
  });
  it('skips months marked missing', () => {
    const reply = { arcticData: { data: { '202610': { value: -9999, anom: 0 } } } };
    expect(parseSeaIce(reply)).toEqual([]);
  });
});

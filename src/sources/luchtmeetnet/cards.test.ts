// Luchtmeetnet cards: nitrogen dioxide at an Amsterdam traffic station, from a saved reply.
// Numbers and times are formatted in the machine's locale, so expected values use the same formatters.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hhmm, nf0 } from '@core/format';
import { expectWellFormedCards, fakeFetch, fixture, runCards } from '@sources/fake-fetch';
import './cards';

const net = fakeFetch(() => fixture('luchtmeetnet', 'no2.json'));
const LAST = Date.parse('2026-11-11T23:00:00Z'); // the newest measurement in the saved reply

describe('Luchtmeetnet', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(LAST + 20 * 60e3);
  });
  afterEach(() => vi.useRealTimers());

  it('builds a well-formed card from the saved reply', async () => {
    expect((await expectWellFormedCards('luchtmeetnet-')).map(r => r.id)).toEqual(['no2-amsterdam']);
  });
  it('shows the last hour measured, with the day’s average against the WHO guideline', async () => {
    const { cards } = await runCards('luchtmeetnet-no2');
    expect(cards['no2-amsterdam']).toMatchObject({
      group: 'nl',
      k: 'NO₂ · Amsterdam, Van Diemenstraat',
      v: `${nf0.format(22.2)} µg/m³`,
      sub: `measured by the road · 24 h average ${nf0.format(14.49)}, within the WHO guideline of 25`,
      src: `Luchtmeetnet · GGD Amsterdam · ${hhmm(LAST)} · chart: last 7 days`,
    });
    expect(cards['no2-amsterdam'].spark).toHaveLength(30);
  });
  it('says so when the day’s average is above the guideline', async () => {
    net.custom = () => ({
      data: [
        { timestamp_measured: '2026-11-11T23:00:00+00:00', value: 40 },
        { timestamp_measured: '2026-11-11T22:00:00+00:00', value: 30 },
        { timestamp_measured: '2026-11-10T22:00:00+00:00', value: 1 }, // more than 24 hours before the last
      ],
    });
    const { cards } = await runCards('luchtmeetnet-no2');
    expect(cards['no2-amsterdam'].sub).toBe(
      `measured by the road · 24 h average ${nf0.format(35)}, above the WHO guideline of 25`,
    );
  });
  it('asks for the last seven days in whole hours', async () => {
    await runCards('luchtmeetnet-no2');
    const url = new URL(net.urls[0]);
    expect(url.searchParams.get('station_number')).toBe('NL49012');
    expect(url.searchParams.get('start')).toBe('2026-11-05T00:00:00Z');
    expect(url.searchParams.get('end')).toBe('2026-11-12T00:00:00Z');
  });
  it('shows no card when the station has been silent for a day', async () => {
    vi.setSystemTime(LAST + 26 * 3600e3);
    expect((await runCards('luchtmeetnet-no2')).cards).toEqual({});
  });
  it('shows no card when nothing was measured', async () => {
    net.custom = () => ({ data: [] });
    expect((await runCards('luchtmeetnet-no2')).cards).toEqual({});
  });
});

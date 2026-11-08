// Planet cards: CO₂ in the air and global sea-ice extent, from saved replies.
// Numbers are formatted in the machine's locale, so expected values use the same formatters.
import { describe, expect, it } from 'vitest';
import { nf1, nf2 } from '@core/format';
import { expectWellFormedCards, fakeFetch, fixture, runCards } from '@sources/fake-fetch';
import './cards';

fakeFetch(url => fixture('global-warming', url.pathname.includes('co2') ? 'co2.json' : 'sea-ice.json'));

describe('the planet', () => {
  it('builds well-formed cards from the saved replies', async () => {
    await expectWellFormedCards('global-warming-');
  });
  it('shows CO₂ in the air and its rise over a year', async () => {
    const { cards } = await runCards('global-warming-co2');
    expect(cards.co2).toMatchObject({ group: 'planet', v: `${nf1.format(428.2)} ppm` });
    expect(cards.co2.sub).toMatch(/^\+.* ppm in a year$/);
    expect(cards.co2.src).toContain('2026-11-04');
  });
  it('shows sea-ice extent against the norm for the month, charting the anomaly', async () => {
    const { cards } = await runCards('global-warming-sea-ice');
    expect(cards.seaice).toMatchObject({
      v: `${nf2.format(22.13)} M km²`,
      src: 'NSIDC via global-warming.org · 2026-09',
    });
    expect(cards.seaice.sub).toContain('vs the 1991–2020 norm for the month');
    expect(cards.seaice.spark?.every(p => Math.abs(p.value) < 5)).toBe(true); // anomalies, not extents
  });
});

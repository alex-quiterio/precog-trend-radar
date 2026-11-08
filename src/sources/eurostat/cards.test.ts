// Eurostat cards: jobs, prices, housing and renewables, from saved (or built JSON-stat) replies.
// Numbers are formatted in the machine's locale, so expected values use the same formatters.
import { describe, expect, it } from 'vitest';
import { nf0, nf1 } from '@core/format';
import { CARD_LOADERS, loadCards } from '@sources/cards';
import { expectWellFormedCards, fakeFetch, fixture, runCards } from '@sources/fake-fetch';
import './cards';

const net = fakeFetch(url =>
  fixture('eurostat', url.pathname.includes('prc_hpi_q') ? 'house-prices.json' : 'unemployment.json'),
);

describe('Eurostat', () => {
  it('builds well-formed cards from the saved replies', async () => {
    await expectWellFormedCards('eurostat-');
  });
  it('shows unemployment with its change over the year', async () => {
    const { cards } = await runCards('eurostat-unemployment');
    expect(cards['unemployment-pt']).toMatchObject({ group: 'pt', v: `${nf1.format(5.6)}%` });
    expect(cards['unemployment-pt'].sub).toMatch(/pts in a year$/);
    expect(cards['unemployment-pt'].src).toBe('Eurostat une_rt_m · 2026-09, seasonally adjusted');
  });
  it('signs year-on-year changes, with a real minus for a fall', async () => {
    const { cards } = await runCards('eurostat-house-prices');
    expect(cards['hpi-pt']).toMatchObject({ v: `+${nf1.format(16.5)}%`, src: 'Eurostat house price index · 2026-Q2' });
    expect(cards['hpi-nl'].v).toBe(`+${nf1.format(4.3)}%`);
  });
  it.each([
    ['eurostat-inflation', 'inflation-'],
    ['eurostat-rents', 'rent-'],
    ['eurostat-energy-prices', 'energyinfl-'],
  ])('%s builds one card per country it has data for', async (id, prefix) => {
    const { cards } = await runCards(id);
    expect(Object.keys(cards).sort()).toEqual([`${prefix}nl`, `${prefix}pt`]);
  });
  it('works out the renewable share of electricity from total and renewable generation', async () => {
    // geo × siec × time: PT and NL, total and renewable, two months.
    net.custom = url =>
      url.pathname.includes('nrg_cb_pem')
        ? {
            id: ['geo', 'siec', 'time'],
            size: [2, 2, 2],
            dimension: {
              geo: { category: { index: { PT: 0, NL: 1 } } },
              siec: { category: { index: { TOTAL: 0, RA000: 1 } } },
              time: { category: { index: { '2026-08': 0, '2026-09': 1 } } },
            },
            // PT total 4000, 4000; PT renewable 2600, 3000; NL total 10000, 10000; NL renewable 5000, 4800.
            value: { 0: 4000, 1: 4000, 2: 2600, 3: 3000, 4: 10000, 5: 10000, 6: 5000, 7: 4800 },
          }
        : undefined;
    const { cards } = await runCards('eurostat-renewables');
    expect(cards['renew-pt']).toMatchObject({ v: `${nf0.format(75)}%`, src: 'Eurostat nrg_cb_pem · 2026-09' });
    expect(cards['renew-pt'].spark?.map(p => p.value)).toEqual([65, 75]);
    expect(cards['renew-nl'].v).toBe(`${nf0.format(48)}%`);
  });
  it('reports each loader that fails by its id', async () => {
    net.custom = url => {
      if (url.hostname === 'ec.europa.eu') throw new Error('down');
    };
    const { rows, failed } = await loadCards(CARD_LOADERS.filter(l => l.id.startsWith('eurostat-')));
    expect(failed.map(f => f.id).sort()).toEqual([
      'eurostat-energy-prices',
      'eurostat-house-prices',
      'eurostat-inflation',
      'eurostat-renewables',
      'eurostat-rents',
      'eurostat-unemployment',
    ]);
    expect(failed[0].error).toMatch(/500/);
    expect(rows).toEqual([]);
  });
});

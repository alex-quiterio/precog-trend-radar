// Eurostat cards: jobs, prices, housing and renewables, from saved (or built JSON-stat) replies.
// Numbers are formatted in the machine's locale, so expected values use the same formatters.
import { describe, expect, it } from 'vitest';
import { fmtPct, nf0, nf1 } from '@core/format';
import { CARD_LOADERS, loadCards } from '@sources/cards';
import { expectWellFormedCards, fakeFetch, fixture, runCards } from '@sources/fake-fetch';
import './cards';

/** The saved reply for each dataset that has its own; the monthly ones share the unemployment reply's shape. */
const SAVED: Record<string, string> = {
  prc_hpi_q: 'house-prices.json',
  sdg_13_10: 'greenhouse-gases.json',
  sdg_06_40: 'nitrate.json',
  env_wasmun: 'municipal-waste.json',
  sdg_12_41: 'circular-use.json',
};
const net = fakeFetch(url => fixture('eurostat', SAVED[url.pathname.split('/').pop() ?? ''] ?? 'unemployment.json'));

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
  it('shows net greenhouse gases per person, with the change over the years in the reply', async () => {
    const { cards } = await runCards('eurostat-sdg_13_10');
    expect(cards['ghg-nl']).toMatchObject({
      group: 'nl',
      k: 'Greenhouse gases · Netherlands',
      v: `${nf1.format(8)} t`,
      sub: `CO₂e per person a year, net of land and forests · ${fmtPct(((8 - 11.9) / 11.9) * 100)} since 2013`,
      src: 'Eurostat sdg_13_10 (EEA) · 2024',
      href: 'https://ec.europa.eu/eurostat/databrowser/view/sdg_13_10/default/table',
    });
    expect(cards['ghg-pt'].v).toBe(`${nf1.format(4.9)} t`);
    expect(cards['ghg-nl'].spark).toHaveLength(12);
    expect(net.urls[0]).toContain('unit=T_HAB&src_crf=TOTXMEMO');
  });
  it('shows nitrate in groundwater against the drinking-water limit', async () => {
    const { cards } = await runCards('eurostat-sdg_06_40');
    expect(cards['nitrate-pt']).toMatchObject({
      group: 'pt',
      v: `${nf1.format(15.7)} mg/L`,
      src: 'Eurostat sdg_06_40 (EEA) · 2023',
    });
    expect(cards['nitrate-pt'].sub).toMatch(/^the drinking-water limit is 50 mg\/L · .* since 2012$/);
  });
  it('shows municipal waste per person', async () => {
    const { cards } = await runCards('eurostat-env_wasmun');
    expect(cards['waste-nl']).toMatchObject({
      v: `${nf0.format(473)} kg`,
      sub: `per person a year · ${fmtPct(((473 - 526) / 526) * 100)} since 2013`,
      src: 'Eurostat env_wasmun · 2024',
    });
    expect(cards['waste-pt'].v).toBe(`${nf0.format(492)} kg`);
  });
  it('shows circular material use, with its change in points', async () => {
    const { cards } = await runCards('eurostat-sdg_12_41');
    expect(cards['circular-nl']).toMatchObject({
      v: `${nf1.format(32.7)}%`,
      sub: `of the materials used were recycled ones · +${nf1.format(6.7)} pts since 2013`,
    });
    expect(cards['circular-pt'].sub).toMatch(/· \+.* pts since 2013$/);
  });
  it('shows a yearly card without a change when the reply holds one year', async () => {
    net.custom = url =>
      url.pathname.endsWith('env_wasmun')
        ? {
            id: ['geo', 'time'],
            size: [1, 1],
            dimension: { geo: { category: { index: { PT: 0 } } }, time: { category: { index: { '2024': 0 } } } },
            value: { 0: 492 },
          }
        : undefined;
    const { cards } = await runCards('eurostat-env_wasmun');
    expect(Object.keys(cards)).toEqual(['waste-pt']); // nothing for the Netherlands: no card
    expect(cards['waste-pt'].sub).toBe('per person a year');
  });
  it('reports each loader that fails by its id', async () => {
    net.custom = url => {
      if (url.hostname === 'ec.europa.eu') throw new Error('down');
    };
    const { rows, failed } = await loadCards(CARD_LOADERS.filter(l => l.id.startsWith('eurostat-')));
    expect(failed.map(f => f.id).sort()).toEqual([
      'eurostat-energy-prices',
      'eurostat-env_wasmun',
      'eurostat-house-prices',
      'eurostat-inflation',
      'eurostat-renewables',
      'eurostat-rents',
      'eurostat-sdg_06_40',
      'eurostat-sdg_12_41',
      'eurostat-sdg_13_10',
      'eurostat-unemployment',
    ]);
    expect(failed[0].error).toMatch(/500/);
    expect(rows).toEqual([]);
  });
});

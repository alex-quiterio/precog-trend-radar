// World Bank cards: forest as a share of the land, from a saved reply.
// Numbers are formatted in the machine's locale, so expected values use the same formatters.
import { describe, expect, it } from 'vitest';
import { nf1 } from '@core/format';
import { HttpError } from '@sources/registry';
import { expectWellFormedCards, fakeFetch, fixture, runCards } from '@sources/fake-fetch';
import './cards';

const net = fakeFetch(() => fixture('worldbank', 'forest-area.json'));

describe('World Bank', () => {
  it('builds well-formed cards from the saved reply', async () => {
    expect((await expectWellFormedCards('worldbank-')).map(r => r.id).sort()).toEqual(['forest-nl', 'forest-pt']);
  });
  it('shows the latest year with a value, and the change since the first', async () => {
    const { cards } = await runCards('worldbank-forest-area');
    expect(cards['forest-pt']).toMatchObject({
      group: 'pt',
      k: 'Forest · Portugal',
      v: `${nf1.format(36.646)}%`,
      sub: `of the land · +${nf1.format(0.5)} pts since 2015`,
      src: 'World Bank (FAO) · 2024', // 2025 has no value yet
    });
    expect(cards['forest-pt'].spark).toHaveLength(10);
    expect(cards['forest-pt'].spark?.[0].t).toBe(Date.UTC(2015, 0, 1));
    expect(cards['forest-nl']).toMatchObject({ group: 'nl', v: `${nf1.format(10.956)}%` });
  });
  it('asks once a day, and keeps yesterday’s numbers when the World Bank is down', async () => {
    await runCards('worldbank-forest-area');
    await runCards('worldbank-forest-area');
    expect(net.urls).toHaveLength(1);
    expect(net.urls[0]).toContain('/country/PRT;NLD/indicator/AG.LND.FRST.ZS');
  });
  it('fails without a saved copy when the World Bank is down', async () => {
    net.custom = () => {
      throw new HttpError(503);
    };
    await expect(runCards('worldbank-forest-area')).rejects.toThrow(/503/);
  });
  it('leaves out a country without rows', async () => {
    net.custom = () => [{}, [{ countryiso3code: 'PRT', date: '2024', value: 36.6 }]];
    const { cards } = await runCards('worldbank-forest-area');
    expect(Object.keys(cards)).toEqual(['forest-pt']);
    expect(cards['forest-pt'].sub).toBe('of the land'); // one year: no change to show
  });
});

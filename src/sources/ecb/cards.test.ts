// ECB cards: the deposit rate, mortgage rates and the 10-year yield, from saved replies.
// Numbers are formatted in the machine's locale, so expected values use the same formatters.
import { describe, expect, it } from 'vitest';
import { nf2 } from '@core/format';
import { expectWellFormedCards, fakeFetch, fixture, runCards } from '@sources/fake-fetch';
import './cards';

const net = fakeFetch(url =>
  fixture(
    'ecb',
    url.pathname.includes('/YC/')
      ? 'bond-yield.json'
      : url.pathname.includes('/MIR/')
        ? 'mortgage-rates.json'
        : 'deposit-rate.json',
  ),
);

describe('ECB', () => {
  it('builds well-formed cards from the saved replies', async () => {
    await expectWellFormedCards('ecb-');
  });
  it('shows the deposit rate and since when it holds', async () => {
    const { cards } = await runCards('ecb-deposit-rate');
    expect(cards.ecb).toMatchObject({
      group: 'ea',
      v: `${nf2.format(2.5)}%`,
      src: 'ECB Data Portal · since 2026-09-16',
    });
  });
  it('shows mortgage rates under each country’s own heading', async () => {
    const { cards } = await runCards('ecb-mortgage-rates');
    expect(Object.keys(cards).sort()).toEqual(['mortgage-ea', 'mortgage-nl', 'mortgage-pt']);
    expect(cards['mortgage-pt']).toMatchObject({
      group: 'pt',
      v: `${nf2.format(3.06)}%`,
      k: 'Mortgage rate · Portugal',
    });
    expect(cards['mortgage-nl'].group).toBe('nl');
    expect(cards['mortgage-pt'].spark?.length).toBeGreaterThan(1);
  });
  it('shows the euro area’s 10-year yield', async () => {
    const { cards } = await runCards('ecb-bond-yield');
    expect(cards['yield-ea-10y']).toMatchObject({ group: 'mkt', v: '3.29%' });
    expect(cards['yield-ea-10y'].src).toContain('2026-11-05');
  });
  it('shows no yield card when the reply has no observations', async () => {
    net.custom = url => (url.pathname.includes('/YC/') ? { dataSets: [{ series: {} }], structure: {} } : undefined);
    const { cards } = await runCards('ecb-bond-yield');
    expect(cards).toEqual({});
  });
});

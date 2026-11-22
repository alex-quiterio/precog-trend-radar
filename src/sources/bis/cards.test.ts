// BIS cards, from saved replies: inflation and policy rates (World), and money and credit (Markets).
// Numbers are formatted in the machine's locale, so expected values use the same formatters.
import { describe, expect, it } from 'vitest';
import { fmtPct, nf0, nf1 } from '@core/format';
import {
  expectWellFormedCards,
  fakeFetch,
  fixture,
  runCards,
} from '@sources/fake-fetch';
import './cards';

/** Each dataset's saved reply. */
const SAVED: Record<string, string> = {
  WS_LONG_CPI: 'cpi.json',
  WS_CBPOL: 'policy-rates.json',
  WS_GLI: 'liquidity.json',
  WS_CBTA: 'cb-assets.json',
  WS_EER: 'eer.json',
  WS_TC: 'credit.json',
  WS_CREDIT_GAP: 'credit-gap.json',
};
const net = fakeFetch(url =>
  fixture('bis', SAVED[url.pathname.split('/')[6]]),
);

describe('BIS', () => {
  it('builds well-formed cards, each in its group', async () => {
    const rows = await expectWellFormedCards('bis-');
    const groups = Object.fromEntries(
      rows.map(r => [r.id, r.group]),
    );
    expect(groups['inflation-jp']).toBe('world');
    expect(groups['rate-in']).toBe('world');
    expect(groups['liquidity-usd']).toBe('money');
    expect(groups['credit-cn']).toBe('money');
    expect(rows).toHaveLength(4 + 4 + 2 + 4 + 4 + 4);
  });
  it('shows inflation with its change over the year', async () => {
    const { cards } = await runCards('bis-inflation');
    expect(cards['inflation-jp']).toMatchObject({
      k: 'Inflation · Japan',
      v: `${nf1.format(2.097902)}%`,
      src: 'BIS consumer prices · 2026-09',
    });
    expect(cards['inflation-jp'].sub).toMatch(
      /^prices vs a year earlier · [+−].* pts in a year$/,
    );
  });
  it('shows each policy rate and how far it moved in a year', async () => {
    const { cards } = await runCards('bis-policy-rates');
    expect(cards['rate-us']).toMatchObject({
      k: 'Policy rate · United States',
      v: `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(3.875)}%`,
    });
    expect(cards['rate-us'].sub).toMatch(
      /^the central bank’s rate · ([+−].* pts|unchanged) in a year$/,
    );
  });
  it('shows dollar credit abroad in trillions, and euro credit by its growth', async () => {
    const { cards } = await runCards('bis-liquidity');
    expect(cards['liquidity-usd'].v).toBe(
      `$${nf1.format(15132723.957 / 1e6)} tn`,
    );
    expect(cards['liquidity-usd'].sub).toContain(
      `${fmtPct(8.03)} in a year`,
    );
    expect(cards['liquidity-eur'].v).toBe(fmtPct(13.813));
  });
  it('compares central bank balance sheets in dollars', async () => {
    const { cards } = await runCards('bis-cb-assets');
    expect(cards['cbassets-us']).toMatchObject({
      k: 'Balance sheet · Fed',
      v: `$${nf1.format(6.73819)} tn`,
    });
    expect(Object.keys(cards).sort()).toEqual([
      'cbassets-cn',
      'cbassets-ea',
      'cbassets-jp',
      'cbassets-us',
    ]);
  });
  it('shows each currency’s real strength against its trading partners', async () => {
    const { cards } = await runCards('bis-eer');
    expect(cards['eer-jp'].k).toBe(
      'Yen, against its trading partners',
    );
    expect(cards['eer-jp'].sub).toMatch(
      /^real effective rate, 2020 = 100/,
    );
  });
  it('shows private credit with its gap from trend, and flags a gap above the warning line', async () => {
    const { cards } = await runCards('bis-credit');
    expect(cards['credit-us'].v).toBe(
      `${nf0.format(139.7)}% of GDP`,
    );
    expect(cards['credit-us'].sub).toBe(
      `households and companies · −${nf1.format(11.3204)} pts from trend`,
    );
    net.custom = url =>
      url.pathname.includes('WS_CREDIT_GAP')
        ? JSON.parse(
            fixture('bis', 'credit-gap.json').replace(
              /"-11\.3204"/,
              '"12.5"',
            ),
          )
        : undefined;
    const again = await runCards('bis-credit');
    expect(again.cards['credit-us'].sub).toContain(
      'above the BIS warning line',
    );
  });
  it('says a policy rate is unchanged rather than "+0 pts"', async () => {
    const { cards } = await runCards('bis-policy-rates');
    const subs = Object.values(cards).map(c => c.sub);
    expect(subs.join(' ')).not.toMatch(/[+−]0 pts/);
  });
});

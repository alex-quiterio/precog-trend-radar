// BIS cards: inflation in the largest economies beyond the euro area, from the saved reply.
// Numbers are formatted in the machine's locale, so expected values use the same formatters.
import { describe, expect, it } from 'vitest';
import { nf1 } from '@core/format';
import {
  expectWellFormedCards,
  fakeFetch,
  fixture,
  runCards,
} from '@sources/fake-fetch';
import './cards';

const net = fakeFetch(() => fixture('bis', 'cpi.json'));

describe('BIS', () => {
  it('builds one card per economy, in the Largest economies group', async () => {
    const rows = await expectWellFormedCards('bis-');
    expect(rows.map(r => r.id)).toEqual([
      'inflation-us',
      'inflation-cn',
      'inflation-jp',
      'inflation-in',
    ]);
    expect(rows.every(r => r.group === 'world')).toBe(true);
  });
  it('shows the latest rate with its change over the year', async () => {
    const { cards } = await runCards('bis-inflation');
    expect(cards['inflation-jp']).toMatchObject({
      k: 'Inflation · Japan',
      v: `${nf1.format(2.097902)}%`,
      src: 'BIS consumer prices · 2026-09',
    });
    expect(cards['inflation-jp'].sub).toMatch(
      /^prices vs a year earlier · [+−].* pts in a year$/,
    );
    expect(cards['inflation-jp'].spark).toHaveLength(13);
  });
  it('asks for all four in one request, as year-on-year rates', async () => {
    await runCards('bis-inflation');
    expect(net.urls).toHaveLength(1);
    expect(net.urls[0]).toContain('M.US+CN+JP+IN.771');
  });
});

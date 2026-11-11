// Our World in Data cards: tree cover lost each year, from a saved CSV.
// Numbers are formatted in the machine's locale, so expected values use the same formatters.
import { describe, expect, it } from 'vitest';
import { nf0 } from '@core/format';
import { expectWellFormedCards, fakeFetch, fixture, runCards } from '@sources/fake-fetch';
import './cards';

const net = fakeFetch(() => fixture('owid', 'tree-cover-loss.csv'));

describe('Our World in Data', () => {
  it('builds well-formed cards from the saved file', async () => {
    expect((await expectWellFormedCards('owid-')).map(r => r.id).sort()).toEqual(['treeloss-nl', 'treeloss-pt']);
  });
  it('shows the latest year’s loss next to the worst year on record', async () => {
    const { cards } = await runCards('owid-tree-cover-loss');
    expect(cards['treeloss-pt']).toMatchObject({
      group: 'pt',
      k: 'Tree cover lost · Portugal',
      v: `${nf0.format(43375.285)} ha`,
      sub: `in 2024, to fire and felling · most: ${nf0.format(173879.23)} ha in 2017`,
      src: 'Global Forest Watch via Our World in Data · since 2001',
    });
    expect(cards['treeloss-pt'].spark?.at(-1)).toEqual({ t: Date.UTC(2024, 0, 1), value: 43375.285 });
    expect(cards['treeloss-nl'].group).toBe('nl');
  });
  it('names no worst year when the latest is the worst', async () => {
    net.custom = () =>
      'entity,code,year,tree_cover_loss_ha__category_total\nPortugal,PRT,2023,10\nPortugal,PRT,2024,20\n';
    const { cards } = await runCards('owid-tree-cover-loss');
    expect(Object.keys(cards)).toEqual(['treeloss-pt']); // no rows for the Netherlands: no card
    expect(cards['treeloss-pt'].sub).toBe('in 2024, to fire and felling');
  });
  it('downloads the file once a day', async () => {
    await runCards('owid-tree-cover-loss');
    await runCards('owid-tree-cover-loss');
    expect(net.urls).toHaveLength(1);
  });
  it('fails on a file without the loss column', async () => {
    net.custom = () => 'entity,code,year\nPortugal,PRT,2024\n';
    await expect(runCards('owid-tree-cover-loss')).rejects.toThrow(/unexpected format/);
  });
});

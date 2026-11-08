// Aloft cards: birds crossing near Lisbon and Amsterdam on the latest radar night.
// Numbers are formatted in the machine's locale, so expected values use the same formatters.
import { describe, expect, it } from 'vitest';
import { nf0 } from '@core/format';
import { expectWellFormedCards, fakeFetch, fixture, runCards } from '@sources/fake-fetch';
import './cards';

const net = fakeFetch(() => fixture('aloft', 'ptlis-vpts.csv'));

describe('Aloft bird migration', () => {
  it('builds well-formed cards from the saved replies', async () => {
    await expectWellFormedCards('aloft-');
  });
  it('shows the birds crossing near Lisbon and Amsterdam on the latest night', async () => {
    const lisbon = (await runCards('aloft-ptlis')).cards['birds-lisbon'];
    expect(lisbon).toMatchObject({
      group: 'pt',
      v: `${nf0.format(3200)} per km`,
      sub: expect.stringMatching(/^heading S at/),
    });
    expect(lisbon.src).toBe('Aloft · Coruche weather radar · night hours of 6 Nov');
    expect((await runCards('aloft-nlhrw')).cards['birds-amsterdam'].group).toBe('nl');
  });
  it('downloads a radar’s file once, then reads it from the cache', async () => {
    await runCards('aloft-ptlis');
    const fetched = net.urls.length;
    await runCards('aloft-ptlis');
    expect(net.urls.length).toBe(fetched);
  });
});

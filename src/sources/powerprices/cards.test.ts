// When power is cheap: the cheapest three hours ahead in the Netherlands and Portugal, from saved replies.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectWellFormedCards, fakeFetch, fixture, runCards } from '@sources/fake-fetch';
import { cheapCard } from './cards';

const at = (h: number) => Date.UTC(2026, 10, 8, h);
let tomorrowOut = true;
const net = fakeFetch(url => {
  if (url.hostname === 'api.energyzero.nl') return fixture('powerprices', 'energyzero.json');
  // REE refuses a range reaching into a day not published yet.
  if (!tomorrowOut && url.searchParams.get('end_date')?.startsWith('2026-11-09')) throw new Error('not yet');
  return fixture('powerprices', 'ree-spot.json');
});
// The saved replies are for 8 Nov 2026: read them at 06:00 UTC that day.
beforeEach(() => {
  tomorrowOut = true;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at(6));
});
afterEach(() => vi.useRealTimers());

describe('cheapCard', () => {
  it('names the hours in local time, today or tomorrow, against the average ahead', () => {
    const prices = [3, 3, 1, 1, 1, 3].map((c, i) => ({ t: at(21 + i), eurKwh: c / 10 }));
    const card = cheapCard(
      { id: 'power-nl', group: 'nl', tz: 'Europe/Amsterdam', src: 'EnergyZero', href: '' },
      prices,
      at(21) + 10 * 60e3,
    )!;
    expect(card.v).toBe('tomorrow 00:00–03:00'); // 23:00 UTC is midnight in Amsterdam
    expect(card.sub).toMatch(/^10 c\/kWh, against 20 c\/kWh on average/);
    expect(card.spark).toHaveLength(6);
    // Nothing left ahead: no card, rather than a stale one.
    expect(cheapCard({ id: 'x', group: 'nl', tz: 'UTC', src: '', href: '' }, prices, at(31))).toBeNull();
  });
});

describe('the loaders', () => {
  it('build well-formed cards from the saved replies', async () => {
    const rows = await expectWellFormedCards('power-');
    expect(rows.map(r => r.id).sort()).toEqual(['power-nl', 'power-pt']);
  });
  it('ask EnergyZero for today and tomorrow, before tax', async () => {
    await runCards('power-nl');
    const q = new URL(net.urls[0]).searchParams;
    expect([q.get('fromDate'), q.get('tillDate'), q.get('inclBtw')]).toEqual([
      '2026-11-08T00:00:00.000Z',
      '2026-11-09T23:59:59.999Z',
      'false',
    ]);
  });
  it('fall back to today alone when REE hasn’t published tomorrow', async () => {
    tomorrowOut = false;
    const { cards } = await runCards('power-pt');
    expect(net.urls.map(u => new URL(u).searchParams.get('end_date'))).toEqual([
      '2026-11-09T23:59',
      '2026-11-08T23:59',
    ]);
    expect(cards['power-pt'].group).toBe('pt');
  });
  it('show no card once every hour has passed', async () => {
    vi.setSystemTime(at(48));
    expect((await runCards('power-nl')).cards).toEqual({});
  });
});

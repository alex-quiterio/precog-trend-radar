// Climate TRACE cards, from replies built per year on the saved ones' shape. The clock is fixed in November 2026,
// so the last full year is 2025 and every series runs 2017–2025.
// Numbers are formatted in the machine's locale, so expected values use the same formatters.
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { nf1 } from '@core/format';
import {
  expectWellFormedCards,
  fakeFetch,
  fixture,
  runCards,
} from '@sources/fake-fetch';
import { lastFullYear } from './cards';

/** A country-emissions reply: one record per country, in megatonnes, with the world's total. */
const reply = (mt: Record<string, number>, rank = 70) =>
  Object.entries(mt).map(([country, v]) => ({
    country,
    rank,
    previousRank: rank,
    emissions: { co2e_100yr: v * 1e6 },
    worldEmissions: { co2e_100yr: 57.65e9 },
  }));
// Forests and land in Portugal: a source in 2017 (the fires), a sink since.
const LAND: Record<number, number> = {
  2017: 80.7,
  2018: -20,
  2019: -30,
  2020: -31.5,
  2025: -57.7,
};

const net = fakeFetch(url => {
  if (url.pathname.endsWith('/assets')) {
    return fixture('climatetrace', 'assets-nld.json');
  }
  const year = Number(url.searchParams.get('since'));
  const sector = url.searchParams.get('sectors');
  if (sector === 'forestry-and-land-use') {
    return reply({ PRT: LAND[year] ?? -40, NLD: 5 });
  }
  if (sector === 'waste') {
    return reply({
      PRT: 5.5 - (year - 2017) * 0.1,
      NLD: 6,
    });
  }
  return year === 2025
    ? fixture('climatetrace', 'country-emissions.json')
    : reply({ PRT: 80, NLD: 230 });
});

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-22T09:00:00Z'));
});
afterAll(() => vi.useRealTimers());

describe('Climate TRACE', () => {
  it('builds well-formed cards', async () => {
    const ids = (
      await expectWellFormedCards('climatetrace-')
    )
      .map(r => r.id)
      .sort();
    expect(ids).toEqual([
      'ctland-nl',
      'ctland-pt',
      'ctrace-nl',
      'ctrace-pt',
      'ctrace-world',
      'cttop-nl',
      'cttop-pt',
      'ctwaste-nl',
      'ctwaste-pt',
    ]);
  });
  it('takes the last full year: two back in January and February, while its months are still arriving', () => {
    expect(lastFullYear(new Date('2026-11-22'))).toBe(2025);
    expect(lastFullYear(new Date('2026-03-01'))).toBe(2025);
    expect(lastFullYear(new Date('2026-02-28'))).toBe(2024);
  });
  it('shows each country’s emissions with its world rank and its change since 2017', async () => {
    const { cards } = await runCards('climatetrace-total');
    expect(cards['ctrace-pt']).toMatchObject({
      group: 'pt',
      k: 'Emissions · Portugal',
      v: `${nf1.format(71.0)} Mt`,
      src: 'Climate TRACE · 2025, not counting forests and land',
    });
    expect(cards['ctrace-pt'].sub).toMatch(
      /^CO₂e in 2025 · world #72 · −\d.*% since 2017$/,
    );
    expect(cards['ctrace-pt'].spark).toHaveLength(9);
    expect(cards['ctrace-world']).toMatchObject({
      group: 'planet',
      v: `${nf1.format(57.6)} Gt`,
    });
  });
  it('shows forests and land as taken up in a sink year, and names the year that released the most', async () => {
    const { cards } = await runCards('climatetrace-land');
    expect(cards['ctland-pt'].v).toBe(
      `−${nf1.format(57.7)} Mt`,
    );
    expect(cards['ctland-pt'].sub).toBe(
      `CO₂e taken up in 2025 · most released: +${nf1.format(80.7)} Mt in 2017`,
    );
  });
  it('names the largest emitter and its sector', async () => {
    const { cards } = await runCards('climatetrace-top');
    expect(cards['cttop-nl']).toMatchObject({
      k: 'Largest emitter · Netherlands',
      v: `${nf1.format(9.9)} Mt`,
      sub: 'Amsterdam Airport Schiphol · international aviation, CO₂e in 2025',
    });
  });
  it('asks once per year, and only once a day', async () => {
    await runCards('climatetrace-waste');
    await runCards('climatetrace-waste');
    expect(net.urls).toHaveLength(9); // 2017–2025
    expect(
      net.urls.every(u => u.includes('sectors=waste')),
    ).toBe(true);
  });
  it('fails when a year answers in an unexpected format, so the card is left out', async () => {
    net.custom = url =>
      url.searchParams.get('since') === '2020'
        ? { error: 'down' }
        : undefined;
    await expect(
      runCards('climatetrace-total'),
    ).rejects.toThrow(/unexpected format/);
  });
});

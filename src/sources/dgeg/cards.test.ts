// DGEG cards: diesel and petrol prices in Portugal, from a saved reply.
// Numbers are formatted in the machine's locale, so expected values use the same formatters.
import { describe, expect, it } from 'vitest';
import { expectWellFormedCards, fakeFetch, fixture, runCards } from '@sources/fake-fetch';
import './cards';

const DAY = 86400e3;
const net = fakeFetch(() => fixture('dgeg', 'pmd.json'));

describe('DGEG fuel prices', () => {
  it('builds well-formed cards from the saved replies', async () => {
    await expectWellFormedCards('dgeg-');
  });
  it('shows diesel and petrol 95 per litre, with the change in a week', async () => {
    const { cards } = await runCards('dgeg-fuel');
    expect(cards['diesel-pt']).toMatchObject({ v: '2,205 €/L', sub: '+16,6 cent in a week' });
    expect(cards['petrol-pt']).toMatchObject({ v: '1,999 €/L', sub: '+1,0 cent in a week' });
    expect(cards['diesel-pt'].src).toBe('DGEG preço médio diário · 2026-11-06 · 1658 stations');
  });
  it('asks for the last 100 days of both fuels', async () => {
    await runCards('dgeg-fuel');
    const q = new URL(net.urls[0]).searchParams;
    expect(q.get('idsTiposComb')).toBe('2101,3201');
    expect(Date.parse(q.get('dataFim')!) - Date.parse(q.get('dataIni')!)).toBe(100 * DAY);
  });
});

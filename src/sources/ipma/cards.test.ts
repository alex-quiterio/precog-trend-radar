// IPMA cards: fire risk and weather warnings in Portugal, which the gist reads too.
// Numbers are formatted in the machine's locale, so expected values use the same formatters.
import { describe, expect, it } from 'vitest';
import { expectWellFormedCards, fakeFetch, fixture, runCards } from '@sources/fake-fetch';
import './cards';

const DAY = 86400e3;
const net = fakeFetch(url => fixture('ipma', url.pathname.includes('warnings') ? 'warnings.json' : 'fire-risk.json'));

describe('IPMA', () => {
  it('builds well-formed cards from the saved replies', async () => {
    await expectWellFormedCards('ipma-');
  });
  it('counts municipalities at very high or maximum fire risk, today and tomorrow, for the gist too', async () => {
    const { cards, facts } = await runCards('ipma-fire-risk');
    expect(cards.fire).toMatchObject({ v: '0 of 6', sub: 'municipalities very high or maximum · tomorrow 0' });
    expect(facts.fire).toEqual({ hi: 0, max: 0, n: 6, tomorrow: 0 });
  });
  it('leaves tomorrow out when its file is missing', async () => {
    net.custom = url => {
      if (url.pathname.endsWith('rcm-d1.json')) throw new Error('not yet');
    };
    const { cards, facts } = await runCards('ipma-fire-risk');
    expect(cards.fire.sub).toBe('municipalities very high or maximum');
    expect(facts.fire?.tomorrow).toBeUndefined();
  });
  it('says none when every warning is green', async () => {
    const { cards, facts } = await runCards('ipma-warnings');
    expect(cards.warnings.v).toBe('none');
    expect(facts.warnings).toEqual({ red: 0, orange: 0, yellow: 0, types: '' });
  });
  it('counts active warnings by colour, names their kinds, and skips the ones that ended', async () => {
    const soon = new Date(Date.now() + DAY).toISOString(),
      past = new Date(Date.now() - DAY).toISOString();
    const w = (level: string, type: string, endTime = soon) => ({
      awarenessLevelID: level,
      awarenessTypeName: type,
      endTime,
    });
    net.custom = url =>
      url.pathname.includes('warnings')
        ? [
            w('red', 'Vento'),
            w('yellow', 'Chuva'),
            w('yellow', 'Vento'),
            w('orange', 'Neve', past),
            w('green', 'Calor'),
          ]
        : undefined;
    const { cards, facts } = await runCards('ipma-warnings');
    expect(cards.warnings).toMatchObject({ v: '1 red · 0 orange · 2 yellow', src: 'IPMA · Vento, Chuva' });
    expect(facts.warnings).toEqual({ red: 1, orange: 0, yellow: 2, types: 'Vento, Chuva' });
  });
});

import { describe, expect, it } from 'vitest';
import pmd from './fixtures/pmd.json';
import { euros, parseDailyAverages } from './parse';

describe('DGEG replies', () => {
  it('reads Portuguese prices', () => {
    expect(euros('2,205 €')).toBe(2.205);
    expect(euros('1.002,5 €')).toBe(1002.5);
    expect(euros('')).toBeNull();
  });
  it('reads one series per fuel, oldest first', () => {
    const byFuel = parseDailyAverages(pmd);
    expect([...byFuel.keys()].sort()).toEqual(['Gasolina simples 95', 'Gasóleo simples']);
    const diesel = byFuel.get('Gasóleo simples')!;
    expect(diesel[diesel.length - 1]).toEqual({ t: Date.UTC(2026, 10, 6), value: 2.205, stations: 1658 });
    expect(diesel[0].t).toBeLessThan(diesel[diesel.length - 1].t);
  });
  it('skips a day without a price', () => {
    const reply = {
      status: true,
      resultado: [
        { Data: '2026-11-06', TipoCombustivel: 'Gasóleo simples', PrecoMedio: '', NumPostos: 1 },
        { Data: '2026-11-05', TipoCombustivel: 'Gasóleo simples', PrecoMedio: '2,200 €', NumPostos: 1 },
      ],
    };
    expect(parseDailyAverages(reply).get('Gasóleo simples')).toHaveLength(1);
  });
  it('refuses a failed reply', () => {
    expect(() => parseDailyAverages({ status: false, mensagem: 'erro' })).toThrow(/erro/);
    expect(() => parseDailyAverages({ status: true })).toThrow(/unexpected format/);
  });
});

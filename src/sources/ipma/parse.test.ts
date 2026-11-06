import { describe, expect, it } from 'vitest';
import fireRisk from './fixtures/fire-risk.json';
import warnings from './fixtures/warnings.json';
import { parseFireRisk, parseWarnings } from './parse';

describe('IPMA replies', () => {
  it('reads each municipality’s fire-risk level and the day it is for', () => {
    expect(parseFireRisk(fireRisk)).toEqual({ levels: [3, 2, 3, 3, 1, 3], day: '2026-11-06' });
  });
  it('keeps only warnings above green that are still running', () => {
    const now = Date.parse('2026-11-06T12:00:00');
    expect(parseWarnings(warnings, now)).toEqual([]); // this reply is all green
    const live = [
      { awarenessLevelID: 'yellow', awarenessTypeName: 'Vento', endTime: '2026-11-06T18:00:00' },
      { awarenessLevelID: 'orange', awarenessTypeName: 'Chuva', endTime: '2026-11-06T06:00:00' }, // over
    ];
    expect(parseWarnings(live, now)).toEqual([{ level: 'yellow', type: 'Vento' }]);
  });
  it('refuses a fire-risk reply without municipalities', () => {
    expect(() => parseFireRisk({ dataPrev: '2026-11-06' })).toThrow(/unexpected format/);
  });
});

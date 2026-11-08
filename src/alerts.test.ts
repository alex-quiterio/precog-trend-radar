// Alert rules: when a topic running hot raises an alert or a watch, how often, and why in a sentence.
import { beforeEach, describe, expect, it } from 'vitest';
import { DAY } from '@core/config';
import { memoryBackend, useBackend } from '@core/storage';
import { computeStats } from '@core/stats';
import { createAppStore, type AppStore } from '@/state';
import type { Entry, SeriesPoint, Stats } from '@/types';
import { evaluate, explain, rescanAll, scanHistory } from './alerts';

const daily = (values: number[], end = Date.UTC(2026, 10, 1)): SeriesPoint[] =>
  values.map((value, i) => ({ t: end - (values.length - 1 - i) * DAY, value }));
const calm = Array.from({ length: 40 }, (_, i) => 100 + (i % 2 ? 3 : -3));
const stats = (o: Partial<Stats> & { z?: number }): Stats & { z: number } => ({
  latest: 0,
  lt: 0,
  step: DAY,
  change: null,
  slope: 0,
  sigma: 1,
  fc: [],
  momentum: 0,
  z: 3,
  baseN: 30,
  above: 0,
  n: 40,
  comp: null,
  ...o,
});

let app: AppStore;
let E: Entry;
beforeEach(() => {
  useBackend(memoryBackend());
  app = createAppStore();
  app.loadLenses();
  E = app.entriesOf(app.lensById('world')!)[0];
  E.liveSeries = daily(calm);
  E.lastAlert = null;
});

describe('explain', () => {
  it('names the topic, how far above its baseline, and what the forecast expects', () => {
    expect(explain('Peak oil', stats({ z: 3.14, slope: 1, above: 12 }))).toBe(
      'Peak oil attention is 3.1σ above its 30-step baseline; projected to keep rising across the full 12-step forecast.',
    );
    expect(explain('X', stats({ slope: 1, above: 1 }))).toContain('keep rising for ~1 step.');
    expect(explain('X', stats({ slope: 1, above: 3 }))).toContain('keep rising for ~3 steps.');
    expect(explain('X', stats({ slope: 1, above: 0 }))).toContain('expect a partial pullback');
    expect(explain('X', stats({ slope: -1 }))).toContain('looks like a short-lived spike');
  });
});

describe('evaluate', () => {
  it('raises nothing for a calm topic', () => {
    expect(evaluate(app, E, computeStats(E.liveSeries)!)).toBeNull();
  });
  it('raises an alert for a spike, with the channel, level and explanation', () => {
    const st = computeStats(daily([...calm.slice(0, -1), 140]))!;
    const a = evaluate(app, E, st)!;
    expect(a).toMatchObject({ key: E.key, lensId: 'world', lens: 'World', topic: E.name, level: 'alert', t: st.lt });
    expect(a.text).toMatch(new RegExp(`^${E.name} attention is`));
    expect(app.state.alertSeq).toBe(a.id);
  });
  it('does not repeat an alert at the same level within six steps', () => {
    const st = computeStats(daily([...calm.slice(0, -1), 140]))!;
    expect(evaluate(app, E, st)).not.toBeNull();
    expect(evaluate(app, E, { ...st, lt: st.lt + 5 * DAY })).toBeNull();
    expect(evaluate(app, E, { ...st, lt: st.lt + 6 * DAY })).not.toBeNull();
  });
  it('lets a watch escalate to an alert straight away', () => {
    const st = computeStats(daily([...calm.slice(0, -1), 140]))!;
    expect(evaluate(app, E, { ...st, z: 2 })?.level).toBe('watch');
    expect(evaluate(app, E, { ...st, lt: st.lt + DAY, z: 3 })?.level).toBe('alert');
  });
});

describe('history', () => {
  it('scanHistory finds the alerts a topic’s history would have raised, oldest first', () => {
    E.liveSeries = daily([...calm, 160, ...calm.slice(0, 10), 170]);
    const alerts = scanHistory(app, E);
    expect(alerts.length).toBeGreaterThanOrEqual(2);
    expect(alerts.map(a => a.t)).toEqual([...alerts.map(a => a.t)].sort((a, b) => a - b));
  });
  it('rescanAll lists every topic’s alerts newest first, and only them', () => {
    E.liveSeries = daily([...calm, 160]);
    rescanAll(app);
    expect(app.state.alerts.length).toBeGreaterThan(0);
    expect(app.state.alerts.every(a => a.key === E.key)).toBe(true);
    const ts = app.state.alerts.map(a => a.t);
    expect(ts).toEqual([...ts].sort((a, b) => b - a));
  });
});

// Unit tests for PRECOG's pure logic: the person guard, statistics and the attention blend.
import { describe, expect, it } from 'vitest';
import { DAY } from '@core/config';
import { HM, hhmm } from '@core/format';
import { looksLikePerson } from '@core/guard';
import { computeStats, levelOf } from '@core/stats';
import { blendParts } from '@sources/blend';
import { ADAPTERS, utcDay } from '@sources/registry';
import type { Entry, SeriesPoint } from '@/types';

const daily = (values: number[], end = Date.UTC(2026, 10, 1)): SeriesPoint[] =>
  values.map((value, i) => ({ t: end - (values.length - 1 - i) * DAY, value }));
const entryWith = (parts: Entry['parts']) => ({ parts }) as Entry;

describe('scope guard', () => {
  it.each([
    'Elon Musk',
    'satya nadella',
    '@someone',
    'me@example.com',
    'Dr. Jane Smith',
    'Mark Zuckerberg',
    'u/someone',
  ])('refuses %s', s => expect(looksLikePerson(s)).toBe(true));
  it.each([
    'AI agents',
    'Solid-state batteries',
    'Remote work',
    'Rust',
    'mark down',
    'Circular economy',
    'Habitação',
    'Stikstofcrisis',
  ])('accepts %s', s => expect(looksLikePerson(s)).toBe(false));
});

describe('computeStats', () => {
  const noisy = Array.from({ length: 40 }, (_, i) => 100 + (i % 2 ? 3 : -3));

  it('gives a calm series a small z-score and a 12-step forecast', () => {
    const st = computeStats(daily(noisy))!;
    expect(Math.abs(st.z!)).toBeLessThan(1.5);
    expect(st.fc).toHaveLength(12);
  });

  it('flags a spike as an alert, and maps z to levels', () => {
    const st = computeStats(daily([...noisy.slice(0, -1), 140]))!;
    expect(st.z!).toBeGreaterThan(2.5);
    expect(levelOf(st.z)).toBe('alert');
    expect(levelOf(2.0)).toBe('watch');
    expect(levelOf(1.0)).toBeNull();
  });

  it('follows the trend, keeps the forecast at or above 0, and compares with 24h earlier', () => {
    const up = computeStats(daily(Array.from({ length: 30 }, (_, i) => 50 + i * 2)))!;
    expect(up.momentum).toBeGreaterThan(0);
    expect(up.fc[11].value).toBeGreaterThan(up.latest);
    const down = computeStats(daily(Array.from({ length: 30 }, (_, i) => 60 - i * 2)))!;
    expect(down.momentum).toBeLessThan(0);
    expect(down.fc.every(f => f.value >= 0 && f.lo >= 0)).toBe(true);
    expect(down.change).toBe(-50); // 2 vs 4 the day before
  });
});

describe('blendParts (world attention index)', () => {
  it('re-bases each source to 100 and only uses days every source has published', () => {
    ADAPTERS.a = { id: 'a', label: 'a', weight: 1, minMean: 0, fetch: async () => ({ topic: '', points: [] }) };
    ADAPTERS.b = { id: 'b', label: 'b', weight: 1, minMean: 0, fetch: async () => ({ topic: '', points: [] }) };
    const end = utcDay() - DAY;
    const E = entryWith({ a: daily(Array(40).fill(200), end), b: daily(Array(40).fill(5), end - DAY) });
    const out = blendParts(E, ['a', 'b']);
    expect(out.length).toBeGreaterThan(30);
    expect(out.at(-1)!.t).toBe(end - DAY);
    expect(out.every(p => Math.abs(p.value - 100) < 1e-9)).toBe(true);
    expect(Object.keys(out.at(-1)!.comp!).sort()).toEqual(['a', 'b']);
  });

  it('falls back to thin sources rather than showing nothing, and marks the topic sparse', () => {
    ADAPTERS.dense = {
      id: 'dense',
      label: 'dense',
      weight: 1,
      minMean: 20,
      fetch: async () => ({ topic: '', points: [] }),
    };
    ADAPTERS.sparse = {
      id: 'sparse',
      label: 'sparse',
      weight: 1,
      minMean: 20,
      fetch: async () => ({ topic: '', points: [] }),
    };
    const end = utcDay() - DAY;
    const E = entryWith({ sparse: daily(Array(40).fill(2), end) });
    expect(blendParts(E, ['sparse']).length).toBeGreaterThan(0);
    expect(E.sparse).toBe(true);
    E.parts.dense = daily(Array(40).fill(500), end);
    blendParts(E, ['dense', 'sparse']);
    expect(E.sparse).toBe(false);
  });
});

describe('clock times', () => {
  it('use a 24-hour clock, midnight as 00, even where the locale prefers 12 hours', () => {
    expect(hhmm(new Date(2026, 0, 1, 14, 5).getTime())).toMatch(/^14.05$/);
    expect(hhmm(new Date(2026, 0, 1, 0, 30).getTime())).toMatch(/^00.30$/);
    expect(new Date(2026, 0, 1, 14, 5).toLocaleTimeString('en-US', HM)).toBe('14:05');
  });
});

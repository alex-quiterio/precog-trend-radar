// The world attention index: re-basing each source and blending the days they share.
import { describe, expect, it } from 'vitest';
import { DAY } from '@core/config';
import { blendParts } from '@sources/blend';
import { ADAPTERS, utcDay } from '@sources/registry';
import type { Entry, SeriesPoint } from '@/types';

const daily = (values: number[], end = Date.UTC(2026, 10, 1)): SeriesPoint[] =>
  values.map((value, i) => ({ t: end - (values.length - 1 - i) * DAY, value }));
const entryWith = (parts: Entry['parts']) => ({ parts }) as Entry;

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

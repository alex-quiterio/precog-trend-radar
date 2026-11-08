// View helpers: axis ticks, alert tags, source breakdowns and SVG paths.
import { describe, expect, it } from 'vitest';
import { nf0 } from '@core/format';
import { compText, niceStep, niceTicks, pathOf, tagOf } from './helpers';

describe('axis ticks', () => {
  it('round a step up to 1, 2, 2.5 or 5 times a power of ten', () => {
    expect([0.7, 1.5, 2.2, 3, 7, 23, 4100].map(niceStep)).toEqual([1, 2, 2.5, 5, 10, 25, 5000]);
  });
  it('run from 0 past the maximum, about four steps', () => {
    expect(niceTicks(100)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(130)).toEqual([0, 50, 100, 150]);
    expect(niceTicks(0.3)).toEqual([0, 0.1, 0.2, 0.3]);
  });
  it('still give two ticks for a flat or empty chart', () => {
    expect(niceTicks(0)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(niceTicks(NaN).length).toBeGreaterThanOrEqual(2);
  });
});

describe('tagOf', () => {
  it('tags an alert, a watch, or normal from the z-score', () => {
    expect(tagOf({ z: 3 })).toEqual({ cls: 'alert', text: '▲ ALERT' });
    expect(tagOf({ z: 2 })).toEqual({ cls: 'watch', text: '◆ WATCH' });
    expect(tagOf({ z: 0.5 })).toEqual({ cls: 'none', text: 'normal' });
    expect(tagOf(null)).toEqual({ cls: 'none', text: 'normal' });
  });
});

describe('compText', () => {
  it('names each source of a blended point with its value', () => {
    expect(compText({ wikipedia: 120, hn: 80.4, other: 5 })).toBe(
      `Wikipedia ${nf0.format(120)} · HN ${nf0.format(80)} · other ${nf0.format(5)}`,
    );
    expect(compText(null)).toBe('');
  });
});

describe('pathOf', () => {
  it('draws an SVG path through the points, to one decimal', () => {
    expect(
      pathOf([
        [0, 10],
        [5.25, 2],
        [10, 0.04],
      ]),
    ).toBe('M0.0,10.0L5.3,2.0L10.0,0.0');
    expect(pathOf([])).toBe('');
  });
});

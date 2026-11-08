// Dates for statistical periods: days, months and quarters, all in UTC.
import { describe, expect, it } from 'vitest';
import { month, periodStart, quarter } from './dates';

describe('periodStart', () => {
  it('reads a day, a month or a quarter as the start of that period', () => {
    expect(periodStart('2026-09-16')).toBe(Date.UTC(2026, 8, 16));
    expect(periodStart('2026-09')).toBe(Date.UTC(2026, 8, 1));
    expect(periodStart('2026-Q1')).toBe(Date.UTC(2026, 0, 1));
    expect(periodStart('2026-Q3')).toBe(Date.UTC(2026, 6, 1));
    expect(periodStart('2026-Q4')).toBe(Date.UTC(2026, 9, 1));
  });
});

describe('month and quarter', () => {
  it('name the UTC month and quarter of a time', () => {
    expect(month(Date.UTC(2026, 8, 30, 23, 59))).toBe('2026-09');
    expect(quarter(Date.UTC(2026, 2, 31))).toBe('2026-Q1');
    expect(quarter(Date.UTC(2026, 3, 1))).toBe('2026-Q2');
    expect(quarter(Date.UTC(2026, 11, 31))).toBe('2026-Q4');
  });
  it('round-trip with periodStart', () => {
    expect(month(periodStart('2026-11'))).toBe('2026-11');
    expect(quarter(periodStart('2026-Q2'))).toBe('2026-Q2');
  });
});

// Number, date and time formatting.
import { describe, expect, it } from 'vitest';
import { HM, hhmm } from '@core/format';

describe('clock times', () => {
  it('use a 24-hour clock, midnight as 00, even where the locale prefers 12 hours', () => {
    expect(hhmm(new Date(2026, 0, 1, 14, 5).getTime())).toMatch(/^14.05$/);
    expect(hhmm(new Date(2026, 0, 1, 0, 30).getTime())).toMatch(/^00.30$/);
    expect(new Date(2026, 0, 1, 14, 5).toLocaleTimeString('en-US', HM)).toBe('14:05');
  });
});

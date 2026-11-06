import { describe, expect, it } from 'vitest';
import twoPlaces from './fixtures/forecast-two-places.json';
import onePlace from './fixtures/forecast-one-place.json';
import { meteoColumn, meteoPlaces, meteoTimes } from './parse';

describe('Open-Meteo replies', () => {
  it('treats a one-place reply and a several-place reply the same way', () => {
    expect(meteoPlaces(twoPlaces)).toHaveLength(2);
    expect(meteoPlaces(onePlace)).toHaveLength(1);
    expect(meteoPlaces(null)).toEqual([]);
  });
  it('reads a daily column, and its days', () => {
    const [lisbon] = meteoPlaces(twoPlaces);
    expect(meteoColumn(lisbon, 'daily', 'temperature_2m_max')).toEqual([17.3]);
    expect(meteoTimes(lisbon, 'daily')).toEqual(['2026-11-06']);
  });
  it('keeps gaps as null and gives an empty column for a missing field', () => {
    expect(meteoColumn({ daily: { rain: [1, null, 'x'] } }, 'daily', 'rain')).toEqual([1, null, null]);
    expect(meteoColumn({}, 'daily', 'rain')).toEqual([]);
  });
});

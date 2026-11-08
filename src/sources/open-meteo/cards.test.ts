// Open-Meteo cards: today's weather and air, sun and wind, and soil moisture.
// Numbers are formatted in the machine's locale, so expected values use the same formatters.
import { describe, expect, it } from 'vitest';
import { nf0, nf1, nf2 } from '@core/format';
import { expectWellFormedCards, fakeFetch, fixture, runCards } from '@sources/fake-fetch';
import { aqiWord } from './cards';

const DAY = 86400e3;
const net = fakeFetch(url =>
  url.hostname.startsWith('air-quality') ? '{}' : fixture('open-meteo', 'forecast-two-places.json'),
);

describe('Open-Meteo', () => {
  it('builds well-formed cards from the saved replies', async () => {
    await expectWellFormedCards('open-meteo-');
  });
  it('shows today’s high and rain for each place in the reply', async () => {
    const { cards } = await runCards('open-meteo-weather');
    expect(cards['wx-lisbon']).toMatchObject({ group: 'pt', v: `${nf0.format(17)}°C` });
    expect(cards['wx-lisbon'].src).toBe(`Open-Meteo · rain ${nf1.format(0.4)} mm`);
    expect(cards['wx-amsterdam']).toBeUndefined(); // the saved reply has two places
  });
  it('adds the air quality in words when it is known', async () => {
    net.custom = url => (url.hostname.startsWith('air-quality') ? [{ current: { european_aqi: 35 } }] : undefined);
    const { cards } = await runCards('open-meteo-weather');
    expect(cards['wx-lisbon'].src).toContain('air 35 (fair)');
  });
  it('names the air-quality bands', () => {
    expect([10, 30, 50, 70, 90, 120, null].map(aqiWord)).toEqual([
      'good',
      'fair',
      'moderate',
      'poor',
      'very poor',
      'extremely poor',
      '',
    ]);
  });
  it('shows today’s solar energy in kWh/m² and the strongest wind', async () => {
    const place = (sun: number[]) => ({
      daily: {
        time: sun.map((_, i) => `2026-11-0${i + 1}`),
        shortwave_radiation_sum: sun,
        wind_speed_10m_max: sun.map(() => 30),
      },
    });
    net.custom = url =>
      url.searchParams.get('daily')?.includes('shortwave') ? [place([9, 18]), place([3.6, 7.2])] : undefined;
    const { cards } = await runCards('open-meteo-sun-wind');
    expect(cards['sun-lisbon']).toMatchObject({
      v: `${nf1.format(5)} kWh/m²`,
      sub: `solar energy on flat ground · wind up to ${nf0.format(30)} km/h`,
    });
    expect(cards['sun-lisbon'].spark?.map(p => p.value)).toEqual([2.5, 5]);
    expect(cards['sun-amsterdam'].v).toBe(`${nf1.format(2)} kWh/m²`);
  });
  it('shows soil moisture as a daily average, against 30 days before, with the rain in between', async () => {
    // 61 days, four readings a day: 0.30 up to 30 days ago, 0.24 since; 2 mm of rain a day.
    const days = Array.from({ length: 61 }, (_, d) =>
      new Date(Date.UTC(2026, 8, 9) + d * DAY).toISOString().slice(0, 10),
    );
    const time = days.flatMap(d => ['00', '06', '12', '18'].map(h => `${d}T${h}:00`));
    net.custom = url =>
      url.searchParams.get('hourly') === 'soil_moisture_3_to_9cm'
        ? {
            hourly: { time, soil_moisture_3_to_9cm: time.map((_, i) => (i < 31 * 4 ? 0.3 : 0.24)) },
            daily: { time: days, precipitation_sum: days.map(() => 2) },
          }
        : undefined;
    const { cards } = await runCards('open-meteo-soil-mafra');
    expect(cards['soil-mafra']).toMatchObject({
      v: `${nf2.format(0.24)} m³/m³`,
      sub: `${nf0.format(-20)}% in 30 days · ${nf0.format(60)} mm of rain`,
    });
    expect(cards['soil-mafra'].spark).toHaveLength(61);
  });
  it('shows no soil card with less than a month of readings', async () => {
    net.custom = url =>
      url.searchParams.get('hourly')
        ? { hourly: { time: ['2026-11-01T00:00'], soil_moisture_3_to_9cm: [0.3] } }
        : undefined;
    expect((await runCards('open-meteo-soil-amsterdam')).cards).toEqual({});
  });
});

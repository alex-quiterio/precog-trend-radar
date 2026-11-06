// PRECOG / Trend Radar · Open-Meteo cards: today's weather and air, sun and wind, and soil moisture.
import { type DatapointGroup, type DatapointRow, registerCards } from '@sources/cards';
import { nf0, nf1, nf2 } from '@core/format';
import { getJSON } from '@sources/registry';
import { at, num } from '@sources/shape';
import { meteoColumn, meteoPlaces, meteoTimes } from './parse';

export const PLACES: [string, number, number, DatapointGroup][] = [
  ['Lisbon', 38.72, -9.14, 'pt'],
  ['Porto', 41.15, -8.61, 'pt'],
  ['Amsterdam', 52.37, 4.9, 'nl'],
];
// Soil moisture cards: [card id, place, latitude, longitude, group].
export const SOIL_PLACES: [string, string, number, number, DatapointGroup][] = [
  ['soil-mafra', 'Mafra', 38.94, -9.33, 'pt'],
  ['soil-amsterdam', 'Amsterdam', 52.37, 4.9, 'nl'],
];
/** The European air-quality index in words. */
export const aqiWord = (v: number | null | undefined): string =>
  v == null
    ? ''
    : v <= 20
      ? 'good'
      : v <= 40
        ? 'fair'
        : v <= 60
          ? 'moderate'
          : v <= 80
            ? 'poor'
            : v <= 100
              ? 'very poor'
              : 'extremely poor';

registerCards({
  id: 'open-meteo-weather',
  async load() {
    const rows: DatapointRow[] = [];
    const lat = PLACES.map(p => p[1]).join(','),
      lon = PLACES.map(p => p[2]).join(',');
    const [wx, aq] = await Promise.all([
      getJSON(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,precipitation_sum&timezone=auto&forecast_days=1`,
      ),
      getJSON(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`,
      ).catch(() => null),
    ]);
    const W = meteoPlaces(wx),
      A = meteoPlaces(aq);
    PLACES.forEach(([name, , , group], i) => {
      const tmax = meteoColumn(W[i], 'daily', 'temperature_2m_max')[0],
        rain = meteoColumn(W[i], 'daily', 'precipitation_sum')[0],
        aqi = num(at(A[i], 'current', 'european_aqi'));
      if (tmax == null) return;
      rows.push({
        group,
        id: `wx-${String(name).toLowerCase()}`,
        k: `${name} today`,
        v: `${nf0.format(tmax)}°C`,
        src: `Open-Meteo · rain ${nf1.format(rain ?? 0)} mm${aqi != null ? ` · air ${aqi} (${aqiWord(aqi)})` : ''}`,
        href: 'https://open-meteo.com/',
        o: 5 + i,
      });
    });
    return rows;
  },
});

registerCards({
  id: 'open-meteo-sun-wind',
  async load() {
    const rows: DatapointRow[] = [];
    const j = await getJSON(
      'https://api.open-meteo.com/v1/forecast?latitude=38.72,52.37&longitude=-9.14,4.9&daily=shortwave_radiation_sum,wind_speed_10m_max&past_days=29&forecast_days=1&timezone=auto',
    );
    (
      [
        ['lisbon', 'Lisbon', 'pt'],
        ['amsterdam', 'Amsterdam', 'nl'],
      ] as [string, string, DatapointGroup][]
    ).forEach(([id, name, group], i) => {
      const place = meteoPlaces(j)[i];
      const sun = meteoColumn(place, 'daily', 'shortwave_radiation_sum'),
        wind = meteoColumn(place, 'daily', 'wind_speed_10m_max'),
        n = sun.length;
      if (!n || sun[n - 1] == null) return;
      rows.push({
        group,
        id: `sun-${id}`,
        k: `Sun and wind · ${name} today`,
        v: `${nf1.format((sun[n - 1] ?? 0) / 3.6)} kWh/m²`,
        sub: `solar energy on flat ground · wind up to ${nf0.format(wind[n - 1] ?? 0)} km/h`,
        src: 'Open-Meteo · chart: last 30 days',
        href: 'https://open-meteo.com/',
        o: 15,
        spark: meteoTimes(place, 'daily').flatMap((t, k) => {
          const v = sun[k];
          return v == null ? [] : [{ t: Date.parse(t), value: v / 3.6 }];
        }),
      });
    });
    return rows;
  },
});

// Is the soil drying out? One loader per place.
SOIL_PLACES.forEach(([id, name, lat, lon, group], i) =>
  registerCards({
    id: `open-meteo-${id}`,
    async load() {
      const rows: DatapointRow[] = [];
      const j = await getJSON(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=soil_moisture_3_to_9cm&daily=precipitation_sum&past_days=60&forecast_days=1&timezone=UTC`,
      );
      const byDay = new Map<string, number[]>();
      const soil = meteoColumn(j, 'hourly', 'soil_moisture_3_to_9cm');
      meteoTimes(j, 'hourly').forEach((t, k) => {
        const v = soil[k];
        if (v == null) return;
        const d = t.slice(0, 10);
        byDay.set(d, [...(byDay.get(d) || []), v]);
      });
      const days = [...byDay.entries()].map(([d, vs]) => ({
        t: Date.parse(d),
        value: vs.reduce((a, b) => a + b, 0) / vs.length,
      }));
      if (days.length < 31) return rows;
      const now = days[days.length - 1],
        before = days[days.length - 31];
      const rain = meteoColumn(j, 'daily', 'precipitation_sum')
        .slice(-31, -1)
        .reduce<number>((a, b) => a + (b ?? 0), 0);
      const change = ((now.value - before.value) / (before.value || 1)) * 100;
      rows.push({
        group,
        id,
        k: `Soil moisture · ${name}`,
        v: `${nf2.format(now.value)} m³/m³`,
        sub: `${change >= 0 ? '+' : ''}${nf0.format(change)}% in 30 days · ${nf0.format(rain)} mm of rain`,
        src: 'Open-Meteo · 3–9 cm below the surface',
        href: 'https://open-meteo.com/en/docs',
        o: 22 + i,
        spark: days,
      });
      return rows;
    },
  }),
);

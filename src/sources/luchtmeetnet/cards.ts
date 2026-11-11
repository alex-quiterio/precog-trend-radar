// PRECOG / Trend Radar · Luchtmeetnet cards: nitrogen dioxide measured on an Amsterdam street, hour by hour.
// Open-Meteo's air cards come from a model; this one is a real instrument next to real traffic.
import { DAY } from '@core/config';
import { hhmm, nf0 } from '@core/format';
import { registerCards } from '@sources/cards';
import { getJSON } from '@sources/registry';
import { parseMeasurements } from './parse';

/** GGD Amsterdam's traffic station on the Van Diemenstraat, by the IJ. */
export const STATION = { number: 'NL49012', name: 'Van Diemenstraat' };
/** The WHO's guideline for nitrogen dioxide: a 24-hour average of 25 µg/m³. */
export const WHO_NO2_DAY = 25;

registerCards({
  id: 'luchtmeetnet-no2',
  async load() {
    // Whole hours, so the address (and any cache in front of it) stays the same for the hour.
    const end = Math.ceil(Date.now() / 3600e3) * 3600e3;
    const iso = (t: number) => new Date(t).toISOString().slice(0, 19) + 'Z';
    const series = parseMeasurements(
      await getJSON(
        `https://api.luchtmeetnet.nl/open_api/measurements?station_number=${STATION.number}&formula=NO2&page=1&order_by=timestamp_measured&order_direction=desc&start=${iso(end - 7 * DAY)}&end=${iso(end)}`,
      ),
    );
    const last = series[series.length - 1];
    // A station that has been silent for a day says nothing about the air now.
    if (!last || end - last.t > DAY) return [];
    const day = series.filter(p => p.t > last.t - DAY);
    const mean = day.reduce((a, p) => a + p.value, 0) / day.length;
    return [
      {
        group: 'nl',
        id: 'no2-amsterdam',
        k: `NO₂ · Amsterdam, ${STATION.name}`,
        v: `${nf0.format(last.value)} µg/m³`,
        sub:
          `measured by the road · 24 h average ${nf0.format(mean)}, ` +
          (mean <= WHO_NO2_DAY
            ? `within the WHO guideline of ${WHO_NO2_DAY}`
            : `above the WHO guideline of ${WHO_NO2_DAY}`),
        src: `Luchtmeetnet · GGD Amsterdam · ${hhmm(last.t)} · chart: last 7 days`,
        href: `https://www.luchtmeetnet.nl/meetpunten?station=${STATION.number}`,
        o: 9,
        spark: series,
      },
    ];
  },
});

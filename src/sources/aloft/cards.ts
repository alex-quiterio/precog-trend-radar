// PRECOG / Trend Radar · Bird migration cards: how many birds crossed near Lisbon and near Amsterdam on the
// latest night, from the nearest weather radar. Shares the per-day cache with the flyway (features/migration.ts),
// so each radar's file is downloaded at most once a day, whichever channel is on screen.
import { nf0 } from '@core/format';
import { type DatapointGroup, type DatapointRow, registerCards } from '@sources/cards';
import { latestDay } from './index';
import { type MigrationDay, compass } from './parse';

const CITIES: { radar: string; id: string; city: string; site: string; group: DatapointGroup; tz: string }[] = [
  { radar: 'ptlis', id: 'birds-lisbon', city: 'Lisbon', site: 'Coruche', group: 'pt', tz: 'Europe/Lisbon' },
  { radar: 'nlhrw', id: 'birds-amsterdam', city: 'Amsterdam', site: 'Herwijnen', group: 'nl', tz: 'Europe/Amsterdam' },
];

/** The card for one city's latest radar night. */
export function crossingCard(c: (typeof CITIES)[number], d: MigrationDay): DatapointRow {
  const at = (t: number) =>
    new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: c.tz });
  const date = new Date(`${d.day}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const n = d.birdsPerKm >= 1000 ? Math.round(d.birdsPerKm / 100) * 100 : Math.round(d.birdsPerKm / 10) * 10;
  return {
    group: c.group,
    id: c.id,
    k: `Birds crossing near ${c.city}`,
    v: `${nf0.format(n)} per km`,
    sub: [
      d.heading != null && d.speedKmh != null ? `heading ${compass(d.heading)} at ${nf0.format(d.speedKmh)} km/h` : '',
      d.peak.mtr > 0 ? `busiest ${at(d.peak.t)}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    src: `Aloft · ${c.site} weather radar · night hours of ${date}`,
    href: 'https://aloftdata.eu/',
    o: 0,
    spark: d.hourly,
  };
}

CITIES.forEach(c =>
  registerCards({
    id: `aloft-${c.radar}`,
    async load() {
      return [crossingCard(c, (await latestDay(c.radar)).day)];
    },
  }),
);

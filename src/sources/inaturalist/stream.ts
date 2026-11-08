// PRECOG / Trend Radar · Sightings streams: the birds people recorded this week around Lisbon and Amsterdam
// (iNaturalist). The birds the channel watches come first, then species nobody recorded the week before (often
// arrivals), then the most recorded.
import { nf0 } from '@core/format';
import { checked, registerStream } from '@sources/streams';
import { WATCHED, birdSightings, type Place, type Sightings } from './index';

const PLACES: { id: string; place: Place }[] = [
  { id: 'seen-lisbon', place: { name: 'Lisbon', lat: 38.72, lng: -9.14, radius: 40 } },
  { id: 'seen-amsterdam', place: { name: 'Amsterdam', lat: 52.37, lng: 4.9, radius: 40 } },
];

PLACES.forEach(({ id, place }) =>
  registerStream<Sightings>({
    id,
    label: `Seen near ${place.name}`,
    load: (_ctx, signal) => birdSightings(place, signal),
    view(ctx, data, at) {
      const week = data?.week ?? [],
        mine = data?.mine ?? [];
      const top = Math.max(1, ...week.map(s => s.count), ...mine.map(s => s.count));
      const isNew = (sid: number) => !!data && data.before.size > 0 && !data.before.has(sid);
      const rest = week.filter(s => !WATCHED[s.id]).sort((a, b) => +isNew(b.id) - +isNew(a.id) || b.count - a.count);
      const list = [...mine, ...rest];
      return {
        rows: list.slice(0, 12).map(s => ({
          id: `${id}-${s.id}`,
          title: s.common,
          url: `https://www.inaturalist.org/taxa/${s.id}`,
          topics: [],
          meta: [
            { text: s.name, cls: 'site' },
            ...(WATCHED[s.id] ? [{ text: 'one of yours', cls: 'flag' }] : []),
            ...(isNew(s.id) ? [{ text: 'new this week', cls: 'flag' }] : []),
          ],
          side: { big: nf0.format(s.count), unit: s.count === 1 ? 'record' : 'records', note: 'iNaturalist · 7 days' },
          bar: (s.count / top) * 100,
        })),
        meta: checked(
          at,
          `${nf0.format(week.length)} species recorded within ${place.radius} km of ${place.name} this week` +
            (data ? ` · ${mine.length ? nf0.format(mine.length) : 'none'} of yours` : ''),
          ctx.now,
        ),
        empty: `No birds recorded near ${place.name} this week yet.`,
      };
    },
  }),
);

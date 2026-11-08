// PRECOG / Trend Radar · When power is cheap: the cheapest three hours ahead to run a wash or charge a car, in
// Portugal (the Iberian day-ahead market, via REE) and the Netherlands (via EnergyZero). Wholesale prices, before
// tax and fees: what moves is the hour, not the bill. Tomorrow's prices appear once published, around 13:00 CET.
import { HOUR } from '@core/config';
import { nf1 } from '@core/format';
import { type DatapointGroup, type DatapointRow, registerCards } from '@sources/cards';
import { getJSON } from '@sources/registry';
import { type HourPrice, cheapestBlock, parseEnergyZero, parseReeSpot } from './parse';

const DAY = 24 * HOUR;
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);

/** A card naming the cheapest three hours from now on, against the average of the hours ahead. */
export function cheapCard(
  o: { id: string; group: DatapointGroup; tz: string; src: string; href: string },
  prices: HourPrice[],
  now = Date.now(),
): DatapointRow | null {
  const hourNow = Math.floor(now / HOUR) * HOUR;
  const ahead = prices.filter(p => p.t >= hourNow);
  const block = cheapestBlock(prices, 3, hourNow);
  if (!block || !ahead.length) return null;
  const local = (t: number, opts: Intl.DateTimeFormatOptions) =>
    new Date(t).toLocaleString('en-GB', { timeZone: o.tz, ...opts });
  const hm = (t: number) => local(t, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const dayOf = (t: number) => local(t, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const when = dayOf(block.start) === dayOf(now) ? 'today' : dayOf(block.start) === dayOf(now + DAY) ? 'tomorrow' : '';
  const mean = ahead.reduce((a, p) => a + p.eurKwh, 0) / ahead.length;
  const cents = (e: number) => `${nf1.format(e * 100)} c/kWh`;
  const last = prices[prices.length - 1];
  return {
    group: o.group,
    id: o.id,
    k: 'Cheapest 3 hours for power',
    v: `${when ? when + ' ' : ''}${hm(block.start)}–${hm(block.end)}`,
    sub: `${cents(block.avg)}, against ${cents(mean)} on average in the hours ahead`,
    src: `${o.src} · day-ahead, before tax · prices until ${local(last.t + HOUR, { weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`,
    href: o.href,
    o: 0,
    spark: ahead.map(p => ({ t: p.t, value: p.eurKwh * 100 })),
  };
}

registerCards({
  id: 'power-nl',
  async load() {
    const now = Date.now();
    const reply = await getJSON(
      `https://api.energyzero.nl/v1/energyprices?fromDate=${ymd(now)}T00:00:00.000Z&tillDate=${ymd(now + DAY)}T23:59:59.999Z` +
        '&interval=4&usageType=1&inclBtw=false',
    );
    const card = cheapCard(
      { id: 'power-nl', group: 'nl', tz: 'Europe/Amsterdam', src: 'EnergyZero', href: 'https://www.energyzero.nl/' },
      parseEnergyZero(reply),
      now,
    );
    return card ? [card] : [];
  },
});

registerCards({
  id: 'power-pt',
  async load() {
    const now = Date.now();
    const url = (end: number) =>
      `https://apidatos.ree.es/en/datos/mercados/precios-mercados-tiempo-real?start_date=${ymd(now)}T00:00` +
      `&end_date=${ymd(end)}T23:59&time_trunc=hour`;
    // Ask for tomorrow too; before it is published REE refuses the whole range, so fall back to today.
    const reply = await getJSON(url(now + DAY)).catch(() => getJSON(url(now)));
    const card = cheapCard(
      {
        id: 'power-pt',
        group: 'pt',
        tz: 'Europe/Lisbon',
        src: 'Iberian market (OMIE) via REE, shared with Spain almost every hour',
        href: 'https://www.omie.es/en/market-results/daily/daily-market/daily-hourly-price',
      },
      parseReeSpot(reply),
      now,
    );
    return card ? [card] : [];
  },
});

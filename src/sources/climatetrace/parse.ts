// PRECOG / Trend Radar · Climate TRACE: reading its country-emissions and assets replies. Emissions are in
// tonnes of CO₂-equivalent over 100 years (co2e_100yr), the measure Climate TRACE ranks countries by.
import { at, list, num, obj, str } from '@sources/shape';

/** One country's emissions over the period asked for, and the world's for the same sectors. */
export interface CountryEmissions {
  /** ISO3, e.g. "PRT". */
  country: string;
  /** Its world rank by emissions (1 = most), and the rank in the period before. */
  rank: number | null;
  previousRank: number | null;
  /** Tonnes CO₂e. Negative for a sink (forests and land can take up more than they release). */
  co2e: number;
  /** The world's tonnes CO₂e, for the same sectors. */
  world: number | null;
}

/** The country-emissions reply. Countries without a total are skipped; a reply that isn't a list throws. */
export function parseCountryEmissions(
  reply: unknown,
): CountryEmissions[] {
  return list(reply, 'Climate TRACE', 'countries').flatMap(
    c => {
      const country = str(at(c, 'country')),
        co2e = num(at(c, 'emissions', 'co2e_100yr'));
      if (!/^[A-Z]{3}$/.test(country) || co2e == null) {
        return [];
      }
      return [
        {
          country,
          rank: num(at(c, 'rank')) ?? null,
          previousRank: num(at(c, 'previousRank')) ?? null,
          co2e,
          world:
            num(at(c, 'worldEmissions', 'co2e_100yr')) ??
            null,
        },
      ];
    },
  );
}

/** A single source of emissions: a plant, an airport, a port. */
export interface Asset {
  name: string;
  /** Climate TRACE's sector, e.g. "international-aviation". */
  sector: string;
  /** Tonnes CO₂e. */
  co2e: number;
}

/** The first asset in an assets reply (Climate TRACE lists them largest first), or null when there is none. */
export function parseTopAsset(
  reply: unknown,
): Asset | null {
  const assets = list(
    at(obj(reply, 'Climate TRACE'), 'assets'),
    'Climate TRACE',
    'assets',
  );
  for (const a of assets) {
    const name = str(at(a, 'Name'));
    const co2e = list(
      at(a, 'EmissionsSummary'),
      'Climate TRACE',
      'EmissionsSummary',
    )
      .filter(e => str(at(e, 'Gas')) === 'co2e_100yr')
      .reduce(
        (sum: number, e) =>
          sum + (num(at(e, 'EmissionsQuantity')) ?? 0),
        0,
      );
    if (name && co2e > 0) {
      return { name, sector: str(at(a, 'Sector')), co2e };
    }
  }
  return null;
}

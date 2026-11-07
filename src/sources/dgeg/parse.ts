// PRECOG / Trend Radar · DGEG (Direção-Geral de Energia e Geologia): reading the daily average fuel prices
// across Portugal's filling stations (precoscombustiveis.dgeg.gov.pt, "Preço médio diário").
import type { SeriesPoint } from '@/types';
import { ShapeError, at, list, num, str } from '@sources/shape';

/** "2,205 €" → 2.205 (Portuguese decimals), or null. */
export const euros = (v: unknown): number | null => {
  const s = str(v).replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
  return s ? num(Number(s)) : null;
};
/** One fuel's day: the average price a litre, and how many stations reported it. */
export interface FuelDay extends SeriesPoint {
  stations: number;
}
/**
 * The PMD reply as one series per fuel ("Gasóleo simples", "Gasolina simples 95"), oldest first. Days
 * without a price are skipped; a reply that isn't a success is refused.
 */
export function parseDailyAverages(reply: unknown): Map<string, FuelDay[]> {
  if (at(reply, 'status') !== true) throw new ShapeError('DGEG', str(at(reply, 'mensagem')) || 'no data');
  const out = new Map<string, FuelDay[]>();
  list(at(reply, 'resultado'), 'DGEG', 'resultado').forEach(r => {
    const fuel = str(at(r, 'TipoCombustivel')),
      day = str(at(r, 'Data')),
      value = euros(at(r, 'PrecoMedio'));
    if (!fuel || !/^\d{4}-\d{2}-\d{2}$/.test(day) || value == null) return;
    const series = out.get(fuel) ?? [];
    series.push({ t: Date.parse(`${day}T00:00:00Z`), value, stations: num(at(r, 'NumPostos')) ?? 0 });
    out.set(fuel, series);
  });
  out.forEach(s => s.sort((a, b) => a.t - b.t));
  return out;
}

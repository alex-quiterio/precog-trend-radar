// PRECOG / Trend Radar · DGEG cards: what a litre of diesel and of petrol 95 costs in Portugal today, on
// average across its filling stations, with three months of history.
import { DAY } from '@core/config';
import { type DatapointRow, registerCards } from '@sources/cards';
import { getJSON } from '@sources/registry';
import { parseDailyAverages } from './parse';

/** DGEG fuel ids, and the card each one becomes. */
const FUELS: { id: number; name: string; card: string; label: string; o: number }[] = [
  { id: 2101, name: 'Gasóleo simples', card: 'diesel-pt', label: 'Diesel · Portugal', o: 6 },
  { id: 3201, name: 'Gasolina simples 95', card: 'petrol-pt', label: 'Petrol 95 · Portugal', o: 7 },
];
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);
const price = (v: number) => `${v.toFixed(3).replace('.', ',')} €`;

registerCards({
  id: 'dgeg-fuel',
  async load() {
    const now = Date.now();
    const q = new URLSearchParams({
      idsTiposComb: FUELS.map(f => f.id).join(','),
      dataIni: ymd(now - 100 * DAY),
      dataFim: ymd(now),
      qtdPorPagina: '400',
      pagina: '1',
      orderDesc: '1',
    });
    const byFuel = parseDailyAverages(await getJSON(`https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb/PMD?${q}`));
    return FUELS.flatMap(f => {
      const series = byFuel.get(f.name) ?? [];
      const last = series[series.length - 1];
      if (!last) return [];
      const weekAgo = [...series].reverse().find(p => p.t <= last.t - 7 * DAY);
      const diff = weekAgo ? (last.value - weekAgo.value) * 100 : null;
      const row: DatapointRow = {
        group: 'pt',
        id: f.card,
        k: f.label,
        v: `${price(last.value)}/L`,
        sub:
          diff == null
            ? 'average across stations'
            : Math.abs(diff) < 0.05
              ? 'same as a week ago'
              : `${diff > 0 ? '+' : '−'}${Math.abs(diff).toFixed(1).replace('.', ',')} cent in a week`,
        src: `DGEG preço médio diário · ${ymd(last.t)} · ${last.stations} stations`,
        href: 'https://precoscombustiveis.dgeg.gov.pt/estatistica/preco-medio-diario/',
        o: f.o,
        spark: series.map(({ t, value }) => ({ t, value })),
      };
      return [row];
    });
  },
});

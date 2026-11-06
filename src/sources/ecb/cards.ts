// PRECOG / Trend Radar · ECB cards: the deposit rate, and mortgage rates for new house-purchase loans.
import { type DatapointGroup, type DatapointRow, registerCards } from '@sources/cards';
import { nf2 } from '@core/format';
import { getJSON } from '@sources/registry';
import { parseEcbLatest, parseEcbSeries } from './parse';
import { month } from '@core/dates';

registerCards({
  id: 'ecb-deposit-rate',
  async load() {
    const rows: DatapointRow[] = [];
    const j = await getJSON(
      'https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.4F.KR.DFR.LEV?format=jsondata&lastNObservations=1',
    );
    const { value: obs, since } = parseEcbLatest(j);
    rows.push({
      group: 'ea',
      id: 'ecb',
      k: 'ECB deposit rate',
      v: `${nf2.format(obs)}%`,
      src: `ECB Data Portal · since ${since}`,
      href: 'https://data.ecb.europa.eu/',
      o: 1,
    });
    return rows;
  },
});

registerCards({
  id: 'ecb-mortgage-rates',
  async load() {
    const rows: DatapointRow[] = [];
    const j = await getJSON(
      'https://data-api.ecb.europa.eu/service/data/MIR/M.PT+NL+U2.B.A2C.A.R.A.2250.EUR.N?format=jsondata&lastNObservations=13',
    );
    const AREA: Record<string, [DatapointGroup, string]> = {
      PT: ['pt', 'Portugal'],
      NL: ['nl', 'Netherlands'],
      U2: ['ea', 'Euro area'],
    };
    parseEcbSeries(j, 1).forEach((series, code) => {
      const area = AREA[code];
      if (!area) return;
      const last = series[series.length - 1];
      if (!last) return;
      rows.push({
        group: area[0],
        id: `mortgage-${area[0]}`,
        k: `Mortgage rate · ${area[1]}`,
        v: `${nf2.format(last.value)}%`,
        sub: 'new house-purchase loans',
        src: `ECB MFI interest rates · ${month(last.t)}`,
        href: 'https://data.ecb.europa.eu/data/datasets/MIR',
        o: 12,
        spark: series,
      });
    });
    return rows;
  },
});

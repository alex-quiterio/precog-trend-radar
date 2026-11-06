// PRECOG / Trend Radar · IPMA cards (Portugal): fire risk today and weather warnings. Both also feed the gist.
import { type DatapointFacts, type DatapointRow, registerCards } from '@sources/cards';
import { getJSON } from '@sources/registry';
import { parseFireRisk, parseWarnings } from './parse';

registerCards({
  id: 'ipma-fire-risk',
  async load() {
    const rows: DatapointRow[] = [],
      facts: DatapointFacts = {};
    const j = await getJSON('https://api.ipma.pt/open-data/forecast/meteorology/rcm/rcm-d0.json');
    const { levels: lv, day } = parseFireRisk(j);
    const hi = lv.filter(x => x >= 4).length,
      max = lv.filter(x => x === 5).length;
    facts.fire = { hi, max, n: lv.length };
    rows.push({
      group: 'pt',
      id: 'fire',
      k: 'Fire risk today',
      v: `${hi} of ${lv.length}`,
      sub: 'municipalities very high or maximum',
      src: `IPMA RCM · ${max} at maximum (5) · ${day}`,
      href: 'https://www.ipma.pt/pt/riscoincendio/rcm.pt/',
      o: 3,
    });
    return { rows, facts };
  },
});

registerCards({
  id: 'ipma-warnings',
  async load() {
    const rows: DatapointRow[] = [],
      facts: DatapointFacts = {};
    const j = await getJSON('https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json');
    const active = parseWarnings(j);
    const by = (l: string) => active.filter(w => w.level === l).length;
    const types = [...new Set(active.map(w => w.type))].slice(0, 3).join(', ');
    facts.warnings = { red: by('red'), orange: by('orange'), yellow: by('yellow'), types };
    rows.push({
      group: 'pt',
      id: 'warnings',
      k: 'Weather warnings (IPMA)',
      v: active.length ? `${by('red')} red · ${by('orange')} orange · ${by('yellow')} yellow` : 'none',
      src: `IPMA${types ? ' · ' + types : ''}`,
      href: 'https://www.ipma.pt/pt/otempo/prev-sam/',
      o: 4,
    });
    return { rows, facts };
  },
});

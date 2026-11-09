// PRECOG / Trend Radar · Constants, lens presets, storage keys and tiny DOM helpers. Loaded first.

export const MIN = 60e3,
  HOUR = 3600e3,
  DAY = 86400e3;
export const MAX_TOPICS = 6,
  MAX_LENSES = 14,
  HISTORY = 90,
  FC_STEPS = 12,
  FIT_N = 20,
  BASE_N = 30;
export const Z_ALERT = 2.5,
  Z_WATCH = 1.8,
  ALERT_CAP = 30,
  MIN_BASE = 8;
export const LIVE_REFRESH_MS = 30 * MIN,
  STORY_REFRESH_MS = 10 * MIN;
// Topic colours in fixed order (validated for colour-blind separation). Red and amber are reserved for alerts.
export const PALETTES = {
  dark: ['#3987e5', '#d55181', '#008300', '#9085e9', '#199e70', '#d95926'],
  light: ['#2a78d6', '#e87ba4', '#008300', '#6250d6', '#1baf7a', '#eb6834'],
};
/** A topic slot's colour in a theme (each theme has its own palette, tuned for contrast). */
export const slotColor = (slot: number, theme: 'dark' | 'light' = 'dark'): string => PALETTES[theme][slot];
export const SLOT_ANGLE = [20, 80, 140, 200, 260, 320];

// Each topic: [display name, { wiki: exact article title, q: search phrase for news and stories,
// also: other names the Reading stream matches, such as the Portuguese ones the channel's sites write in }]
// One lens per channel (see channels.ts). English Wikipedia throughout: Portuguese and Dutch articles on
// these subjects get too few views (1-20 a day) for a trend to mean anything.
export const PRESETS = [
  {
    id: 'world',
    name: 'World',
    desc: 'The big stories, and the slow plates under them.',
    topics: [
      ['Russo-Ukrainian war', { q: 'Ukraine' }],
      ['Gaza war', { q: 'Gaza' }],
      ['Tariffs', { wiki: 'Tariff', q: 'tariffs' }],
      ['NATO'],
      ['Inflation'],
      ['Artificial intelligence', { q: 'AI' }],
    ],
  },
  {
    id: 'turning',
    name: 'The Great Turning',
    desc: 'The shift to a life-sustaining world, after Joanna Macy: what is ending, and what is being built.',
    topics: [
      ['Climate change'],
      ['Peak oil'],
      ['Degrowth'],
      ['Overshoot', { wiki: 'Overshoot (population)', q: 'ecological overshoot' }],
      ['Biodiversity loss'],
      ['Strait of Hormuz', { q: 'Hormuz' }],
    ],
  },
  {
    id: 'energy',
    name: 'Energy & power',
    desc: 'How electricity is made, stored and priced, and what that costs at home.',
    topics: [
      ['Renewable energy'],
      ['Solar power'],
      ['Wind power'],
      ['Energy storage'],
      ['Heat pump'],
      ['Nuclear power'],
    ],
  },
  {
    id: 'portugal',
    name: 'Portugal & the land',
    desc: 'Fire and water in the interior, and the practices behind a rural, closed-loop life on the land.',
    topics: [
      [
        'Wildfires',
        {
          wiki: 'Wildfire',
          q: 'wildfire',
          also: ['incêndios', 'incêndio rural', 'incêndio florestal', 'fogos florestais', 'fogo florestal'],
        },
      ],
      ['Desertification', { also: ['desertificação'] }],
      ['Rainwater harvesting', { also: ['água da chuva', 'águas pluviais'] }],
      ['Agroforestry', { also: ['agrofloresta', 'agroflorestal', 'agroflorestais', 'montado'] }],
      ['Permaculture', { also: ['permacultura'] }],
      ['Ecovillage', { q: 'ecovillage', also: ['ecoaldeia', 'ecoaldeias', 'eco-aldeia'] }],
    ],
  },
  {
    id: 'housing',
    name: 'Housing',
    desc: 'Prices, rents and mortgages in Portugal and the Netherlands, and the politics of a home.',
    topics: [
      ['Housing crisis'],
      ['Affordable housing'],
      ['Rent control'],
      ['Mortgage loan', { q: 'mortgage rates' }],
      ['Gentrification'],
      ['Short-term rental', { q: 'short-term rental' }],
    ],
  },
  {
    id: 'circular',
    name: 'Circular economy',
    desc: 'Waste, packaging and reporting rules: what shapes B2B recycling and waste services.',
    topics: [
      ['Circular economy'],
      ['Recycling'],
      ['Packaging rules (PPWR)', { wiki: 'Packaging and packaging waste directive', q: 'packaging waste regulation' }],
      ['Producer responsibility', { wiki: 'Extended producer responsibility', q: 'extended producer responsibility' }],
      ['Food waste', { wiki: 'Food loss and waste', q: 'food waste' }],
      ['CSRD', { wiki: 'Sustainability reporting', q: 'CSRD' }],
    ],
  },
  {
    id: 'amsterdam',
    name: 'Alternative Amsterdam',
    desc: 'The cooperative, regenerative city: doughnut economics, housing co-ops, mutual aid and urban farms.',
    topics: [
      ['Doughnut economics', { wiki: 'Doughnut (economic model)', q: 'doughnut economics' }],
      ['Housing cooperative'],
      ['Community land trust'],
      ['Mutual aid', { wiki: 'Mutual aid (organization theory)', q: 'mutual aid' }],
      ['Urban agriculture'],
      ['Repair Café', { q: 'repair cafe' }],
    ],
  },
  {
    id: 'markets',
    name: 'Markets',
    desc: 'International markets: stocks, bonds, currencies, oil, gold and crypto, and the fear of a downturn.',
    topics: [
      ['S&P 500', { q: 'S&P 500' }],
      ['Treasury yields', { wiki: 'United States Treasury security', q: 'Treasury yields' }],
      ['Oil prices', { wiki: 'Price of oil', q: 'oil prices' }],
      ['Gold', { wiki: 'Gold as an investment', q: 'gold price' }],
      ['Bitcoin'],
      ['Recession'],
    ],
  },
  {
    id: 'marginalian',
    name: 'The Marginalian',
    desc: 'Art, science, poetry and philosophy: what it means to live a decent, substantive, rewarding life.',
    topics: [
      ['Poetry'],
      ['Taoism', { q: 'Tao' }],
      ['Jungian psychology', { wiki: 'Analytical psychology', q: 'Jungian' }],
      ['Mysticism'],
      ['Grief'],
      ['Meaning of life'],
    ],
  },
  {
    id: 'birds',
    name: 'Bird migration',
    desc: 'The birds that travel the flyway between the Netherlands and Portugal, and when they pass.',
    topics: [
      ['White stork', { q: 'white stork', also: ['cegonha-branca', 'cegonhas', 'ooievaar', 'ooievaars'] }],
      ['Black-tailed godwit', { q: 'godwit', also: ['milherango', 'grutto', 'grutto’s'] }],
      ['Eurasian spoonbill', { q: 'spoonbill', also: ['colhereiro', 'lepelaar', 'lepelaars'] }],
      ['Common crane', { q: 'common crane', also: ['grou', 'grous', 'kraanvogel', 'kraanvogels'] }],
      [
        'Starling',
        { wiki: 'Common starling', q: 'starlings', also: ['estorninho', 'estorninhos', 'spreeuw', 'spreeuwen'] },
      ],
      ['Barn swallow', { q: 'swallows', also: ['andorinha', 'andorinhas', 'boerenzwaluw', 'zwaluwen'] }],
    ],
  },
  {
    id: 'github',
    name: 'GitHub',
    desc: 'The stack and ideas worth watching early, and your own work.',
    topics: [
      ['AI agents', { wiki: 'AI agent', q: 'AI agents' }],
      ['MCP', { wiki: 'Model Context Protocol', q: 'Model Context Protocol' }],
      ['Rust', { wiki: 'Rust (programming language)', q: 'Rust' }],
      ['TypeScript'],
      ['Vue.js', { q: 'Vue' }],
      ['Local-first software', { q: 'local-first' }],
    ],
  },
];
/**
 * Other names a shipped topic goes by in its lens (`also` above), for matching text written in them. Read from
 * the presets rather than storage, so saved lenses pick them up without an upgrade.
 */
export function otherNames(lensId: string, name: string): string[] {
  const n = name.toLowerCase();
  const t = PRESETS.find(p => p.id === lensId)?.topics.find(t => String(t[0]).toLowerCase() === n);
  const o = t?.[1];
  return typeof o === 'object' && o && 'also' in o && Array.isArray(o.also) ? o.also : [];
}
// v8 re-ran the upgrade for browsers that versions 5-7 marked as upgraded without saving the new lenses.
// v9 adds Energy & power and Housing.
// v10 tunes Portugal & the land (water, agroforestry, ecovillages), Alt Amsterdam (mutual aid) and The Marginalian
// (Taoism, Jungian psychology, mysticism).
// v11 adds Markets.
// v12 adds Bird migration.
// v13 turns The Great Simplification ('tgs') into The Great Turning ('turning').
export const PRESET_VERSION = 13;
/** Lenses whose topics are picked each day rather than shipped (see features/hot-topics.ts). */
export const PICKED_LENSES = ['world', 'amsterdam'];
export const LS = {
  presetVer: 'precog.presetver',
  lenses: 'precog.lenses.v1',
  oldWatch: 'precog.watchlist.v1',
  layout: 'precog.layout.v3',
  prefs: 'precog.prefs.v2',
  look: 'precog.lastlook.v1',
  wikiTitles: 'precog.wikititle.v1',
  storyObs: 'precog.storyobs.v1',
  hot: 'precog.hot.v1',
  wikiNews: 'precog.wikinews.v1',
  wikiSummaries: 'precog.wikisum.v1',
};

// Storage lives in core/storage.ts; re-exported here because most modules import it with the keys above.
export { store } from '@core/storage';
export const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

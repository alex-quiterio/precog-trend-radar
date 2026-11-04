// PRECOG / Trend Radar · Constants, lens presets, storage keys and tiny DOM helpers. Loaded first.

export const MIN = 60e3,
  HOUR = 3600e3,
  DAY = 86400e3;
export const MAX_TOPICS = 6,
  MAX_LENSES = 10,
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
const currentTheme = (): 'dark' | 'light' =>
  typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
export const slotColor = (slot: number): string => PALETTES[currentTheme()][slot];
export const SLOT_ANGLE = [20, 80, 140, 200, 260, 320];

// Each topic: [display name, { wiki: exact article title, q: search phrase for news and stories }]
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
    id: 'tgs',
    name: 'The Great Simplification',
    desc: 'Energy, ecology and the economy as one system, after Nate Hagens.',
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
    desc: 'The interior, fire and water, and the practices behind a rural, closed-loop life.',
    topics: [
      ['Alentejo'],
      ['Wildfires', { wiki: 'Wildfire', q: 'wildfire' }],
      ['Desertification'],
      ['Rural flight'],
      ['Permaculture'],
      ['Regenerative agriculture'],
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
    desc: 'The cooperative, regenerative city: doughnut economics, housing co-ops, squats and urban farms.',
    topics: [
      ['Doughnut economics', { wiki: 'Doughnut (economic model)', q: 'doughnut economics' }],
      ['Housing cooperative'],
      ['Community land trust'],
      ['Squatting'],
      ['Urban agriculture'],
      ['Repair Café', { q: 'repair cafe' }],
    ],
  },
  {
    id: 'marginalian',
    name: 'The Marginalian',
    desc: 'Art, science, poetry and philosophy: what it means to live a decent, substantive, rewarding life.',
    topics: [['Poetry'], ['Consciousness'], ['Stoicism'], ['Grief'], ['Solitude'], ['Meaning of life']],
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
// v8 re-ran the upgrade for browsers that versions 5-7 marked as upgraded without saving the new lenses.
// v9 adds Energy & power and Housing.
export const PRESET_VERSION = 9;
export const LS = {
  presetVer: 'precog.presetver',
  lenses: 'precog.lenses.v1',
  oldWatch: 'precog.watchlist.v1',
  layout: 'precog.layout.v3',
  prefs: 'precog.prefs.v2',
  look: 'precog.lastlook.v1',
  wikiTitles: 'precog.wikititle.v1',
  storyObs: 'precog.storyobs.v1',
};

export const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown): void {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* storage unavailable or full */
    }
  },
};
export const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

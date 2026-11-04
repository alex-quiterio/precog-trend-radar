// PRECOG / Trend Radar · Constants, lens presets, storage keys and tiny DOM helpers. Loaded first.

export const MIN = 60e3,
  HOUR = 3600e3,
  DAY = 86400e3;
export const MAX_TOPICS = 6,
  MAX_LENSES = 8,
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

// Every source a lens can switch on. A lens is its own dashboard: these decide which trend
// sources feed its chart, which story tabs it shows and which datapoint cards it shows.
export type SourceKind = 'trend' | 'stories' | 'datapoints';
export const SOURCE_CATALOG: { id: string; label: string; kind: SourceKind }[] = [
  { id: 'wikipedia', label: 'Wikipedia', kind: 'trend' },
  { id: 'news', label: 'Global news', kind: 'trend' },
  { id: 'hn', label: 'Hacker News', kind: 'trend' },
  { id: 'github', label: 'GitHub', kind: 'trend' },
  { id: 'rss', label: 'PT · NL feeds', kind: 'trend' },
  { id: 'forecasts', label: 'Forecasts', kind: 'stories' },
  { id: 'tgs', label: 'Great Simplification', kind: 'stories' },
  { id: 'economy', label: 'ECB · Eurostat', kind: 'datapoints' },
  { id: 'pt-hazards', label: 'IPMA fire · warnings', kind: 'datapoints' },
  { id: 'weather', label: 'Weather · air', kind: 'datapoints' },
  { id: 'planet', label: 'CO₂ · sea ice', kind: 'datapoints' },
  { id: 'soil', label: 'Alentejo soil', kind: 'datapoints' },
];
export const ALL_SOURCES = SOURCE_CATALOG.map(s => s.id);

// Each topic: [display name, { wiki: exact article title, q: search phrase for news/HN }]
export const PRESETS = [
  {
    id: 'world',
    name: 'World',
    desc: 'The big picture: the forces moving the most attention worldwide.',
    sources: ['wikipedia', 'news', 'forecasts', 'tgs', 'economy', 'planet'],
    topics: [
      ['Climate change'],
      ['Artificial intelligence', { q: 'AI' }],
      ['Inflation'],
      ['Russo-Ukrainian war', { q: 'Ukraine' }],
      ['Gaza war', { q: 'Gaza' }],
      ['Tariffs', { wiki: 'Tariff', q: 'tariffs' }],
    ],
  },
  {
    id: 'geo',
    name: 'Geopolitics',
    desc: 'Alliances, trade and resources: the slow plates under the news.',
    sources: ['wikipedia', 'news', 'forecasts', 'economy'],
    topics: [
      ['NATO'],
      ['BRICS'],
      ['Sanctions', { wiki: 'Economic sanctions', q: 'sanctions' }],
      ['Critical minerals'],
      ['Taiwan Strait', { wiki: 'Cross-strait relations', q: 'Taiwan' }],
      ['Immigration'],
    ],
  },
  {
    id: 'climate',
    name: 'Climate & energy',
    desc: 'Heat, fire, water and the energy transition.',
    sources: ['wikipedia', 'news', 'hn', 'forecasts', 'tgs', 'planet', 'pt-hazards', 'weather'],
    topics: [
      ['Heat waves', { wiki: 'Heat wave', q: 'heatwave' }],
      ['Wildfires', { wiki: 'Wildfire', q: 'wildfire' }],
      ['Solar power'],
      ['Carbon price'],
      ['Drought'],
      ['Energy transition'],
    ],
  },
  {
    id: 'circular',
    name: 'Circular economy',
    desc: 'Waste, packaging and reporting rules: what shapes B2B recycling and waste services.',
    sources: ['wikipedia', 'news', 'tgs', 'economy'],
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
    id: 'portugal',
    name: 'Portugal',
    lang: 'pt',
    country: 'portugal',
    desc: 'Housing, fire, water and the interior, read through Portuguese Wikipedia and Portuguese outlets.',
    sources: ['wikipedia', 'news', 'rss', 'pt-hazards', 'weather', 'soil', 'economy'],
    topics: [
      ['Habitação', { wiki: 'Habitação em Portugal', q: 'habitação' }],
      ['Incêndios', { wiki: 'Incêndios florestais em Portugal', q: 'incêndios' }],
      ['Seca', { q: 'seca' }],
      ['Êxodo rural', { q: 'despovoamento' }],
      ['Alentejo'],
      ['Lítio', { q: 'lítio' }],
    ],
  },
  {
    id: 'land',
    name: 'Land & homestead',
    desc: 'Growing food, restoring land and living lighter: the practices behind a rural, closed-loop life.',
    sources: ['wikipedia', 'news', 'hn', 'tgs', 'soil', 'weather', 'pt-hazards'],
    topics: [
      ['Permaculture'],
      ['Regenerative agriculture'],
      ['Agroforestry'],
      ['Rewilding'],
      ['Off-grid living', { wiki: 'Off-the-grid', q: 'off-grid' }],
      ['Ecovillages', { wiki: 'Ecovillage', q: 'ecovillage' }],
    ],
  },
  {
    id: 'nl',
    name: 'Nederland',
    lang: 'nl',
    country: 'netherlands',
    desc: 'Dutch housing, nitrogen, energy and waste policy, read through Dutch Wikipedia and Dutch outlets.',
    sources: ['wikipedia', 'news', 'rss', 'weather', 'economy'],
    topics: [
      ['Woningnood'],
      ['Stikstofcrisis', { wiki: 'Stikstofcrisis in Nederland', q: 'stikstof' }],
      ['Statiegeld'],
      ['Circulaire economie'],
      ['Energietransitie'],
      ['Asiel', { wiki: 'Asielzoeker', q: 'asiel' }],
    ],
  },
  {
    id: 'tgs',
    name: 'Great Simplification',
    desc: 'Energy, ecology and the economy as one system: the themes of Nate Hagens’ The Great Simplification.',
    sources: ['wikipedia', 'news', 'hn', 'forecasts', 'tgs', 'planet'],
    topics: [
      ['Degrowth'],
      ['Peak oil'],
      ['EROI', { wiki: 'Energy return on investment', q: 'energy return on investment' }],
      ['Overshoot', { wiki: 'Overshoot (population)', q: 'ecological overshoot' }],
      ['Biodiversity loss'],
      ['Strait of Hormuz', { q: 'Hormuz' }],
    ],
  },
];
export const PRESET_VERSION = 4;
export const LS = {
  presetVer: 'precog.presetver',
  lenses: 'precog.lenses.v1',
  oldWatch: 'precog.watchlist.v1',
  layout: 'precog.layout.v3',
  prefs: 'precog.prefs.v2',
  rss: 'precog.rss.v1',
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

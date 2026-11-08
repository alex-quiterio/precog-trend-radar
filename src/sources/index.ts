// PRECOG / Trend Radar · Every source, in one place. Importing a module registers what it provides:
// trend sources (the attention index), streams (tabs under "Matched to your topics") and open-data cards.
// To add a source, add its module here (see docs/ADDING-SOURCES.md).

// Trend sources: one line each in the attention index
import '@sources/wikipedia';
import '@sources/guardian';
import '@sources/hackernews';

// Streams, in no particular order: each channel lists the ones it shows, in its own order
import '@sources/guardian/stream';
import '@sources/reading/stream';
import '@sources/manifold/stream';
import '@sources/hackernews/stream';
import '@sources/inaturalist/stream';

// Open-data cards: each channel lists the cards it shows, by id
import '@sources/ecb/cards';
import '@sources/eurostat/cards';
import '@sources/ipma/cards';
import '@sources/open-meteo/cards';
import '@sources/global-warming/cards';
import '@sources/dgeg/cards';
import '@sources/aloft/cards';

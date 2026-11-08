// Importing the source list registers every trend source, stream and open-data card loader.
import { describe, expect, it } from 'vitest';
import { CARD_LOADERS } from '@sources/cards';
import { ADAPTERS, SOURCES } from '@sources/registry';
import { STREAMS } from '@sources/streams';
import './index';

describe('the source list', () => {
  it('registers the three trend sources behind the attention index', () => {
    expect(Object.keys(ADAPTERS).sort()).toEqual(['guardian', 'hn', 'wikipedia']);
    expect(SOURCES.blend.parts).toEqual(['wikipedia', 'guardian', 'hn']);
  });
  it('registers every stream once', () => {
    expect(STREAMS.map(s => s.id).sort()).toEqual(
      ['forecasts', 'hn', 'news', 'reading', 'seen-amsterdam', 'seen-lisbon'].sort(),
    );
  });
  it('registers a card loader for every open-data provider', () => {
    const providers = new Set(CARD_LOADERS.map(l => l.id.split('-')[0]));
    expect([...providers].sort()).toEqual(
      ['aloft', 'dgeg', 'ecb', 'eurostat', 'global', 'ipma', 'open', 'power'].sort(),
    );
  });
});

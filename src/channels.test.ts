// Channels: the shipped ones hang together (lenses, streams, sites), and a lens you make gets its own channel.
import { beforeEach, describe, expect, it } from 'vitest';
import { PRESETS } from '@core/config';
import { memoryBackend, useBackend } from '@core/storage';
import { CAMPFIRE, TURNING_SITES, siteByUrl } from '@sources/reading';
import { streamById } from '@sources/streams';
import '@sources/index';
import { createAppStore, type AppStore } from '@/state';
import { CHANNELS, activeChannel, channelOfLens, channels, isBuiltInLens } from './channels';

let app: AppStore;
beforeEach(() => {
  useBackend(memoryBackend());
  app = createAppStore();
  app.loadLenses();
});

describe('the shipped channels', () => {
  it('have unique ids, each showing one shipped lens', () => {
    expect(new Set(CHANNELS.map(c => c.id)).size).toBe(CHANNELS.length);
    const presets = new Set(PRESETS.map(p => p.id));
    CHANNELS.forEach(c => expect(presets.has(c.lensId), c.id).toBe(true));
  });
  it('list only streams that exist', () => {
    CHANNELS.forEach(c => c.streams.forEach(s => expect(streamById(s), `${c.id}: ${s}`).toBeDefined()));
  });
  it('read only sites PRECOG knows, for their streams and their stories', () => {
    CHANNELS.forEach(c =>
      [...(c.sites ?? []), ...(c.stories?.sites ?? []), ...(c.stories?.latest?.sites ?? [])].forEach(url =>
        expect(siteByUrl(url), `${c.id}: ${url}`).toBeDefined(),
      ),
    );
  });
  it('The Great Turning reads all its voices, and tells stories from the dated ones only', () => {
    const turning = CHANNELS.find(c => c.id === 'turning')!;
    expect(turning.sites?.map(u => siteByUrl(u)?.name)).toEqual(TURNING_SITES.map(s => s.name));
    expect(turning.sites).toContain(CAMPFIRE.url);
    expect(turning.stories?.sites.map(u => siteByUrl(u)?.name)).toEqual(['The Great Simplification', 'Local Futures']);
  });
});

describe('channels for an app', () => {
  it('shows a shipped channel for each shipped lens, in order', () => {
    expect(channels(app).map(c => c.id)).toEqual(CHANNELS.map(c => c.id));
  });
  it('adds a plain channel for a lens you made, which is not built in', () => {
    app.state.lenses.push({ id: 'mine', name: 'Mine', desc: '', topics: [] });
    const own = channelOfLens(app, 'mine')!;
    expect(own).toMatchObject({
      label: 'Mine',
      kicker: 'Your own lens.',
      own: true,
      streams: ['reading', 'forecasts', 'hn'],
    });
    expect(isBuiltInLens('mine')).toBe(false);
    expect(isBuiltInLens('turning')).toBe(true);
  });
  it('leaves out a shipped channel whose lens is gone', () => {
    app.state.lenses = app.state.lenses.filter(l => l.id !== 'markets');
    expect(channels(app).some(c => c.id === 'markets')).toBe(false);
  });
  it('shows the active lens’s channel, or the first when none is active', () => {
    app.state.activeLens = 'turning';
    expect(activeChannel(app).id).toBe('turning');
    app.state.activeLens = 'gone';
    expect(activeChannel(app).id).toBe(CHANNELS[0].id);
  });
});

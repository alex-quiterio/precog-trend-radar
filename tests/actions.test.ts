// Actions on their own app store, with fake services: no shared state, no network.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createActions, parseTopicInput } from '@/actions';
import { createContext } from '@/context';
import { memoryBackend, useBackend } from '@core/storage';
import { createAppStore, type AppStore } from '@/state';

let app: AppStore;
let live: {
  signal: () => undefined;
  parts: () => string[];
  fetchPart: ReturnType<typeof vi.fn>;
  setStatus: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
};
let stories: { load: ReturnType<typeof vi.fn>; status: { at: Record<string, number> } };
let actions: ReturnType<typeof createActions>;

beforeEach(() => {
  useBackend(memoryBackend());
  app = createAppStore();
  app.loadLenses();
  app.state.activeLens = 'github';
  live = {
    signal: () => undefined,
    parts: () => ['a', 'b'],
    fetchPart: vi.fn(async () => {}),
    setStatus: vi.fn(),
    start: vi.fn(),
  };
  stories = { load: vi.fn(async () => {}), status: { at: {} } };
  actions = createActions(app, { live, stories });
});

describe('topic input', () => {
  it('reads a name, a Wikipedia title and a query', () => {
    expect(parseTopicInput('Heat pumps | wiki: Heat pump | q: "air source heat pump"')).toEqual({
      name: 'Heat pumps',
      slot: -1,
      wiki: 'Heat pump',
      q: '"air source heat pump"',
    });
  });
});

describe('actions', () => {
  it('adds a topic to the channel on screen, selects it and fetches it from every source', () => {
    const lens = app.activeLens()!;
    const before = lens.topics.length;
    lens.topics.splice(5); // make room
    expect(actions.addTopic('Zig')).toBe(true);
    expect(lens.topics.map(t => t.name)).toContain('Zig');
    expect(app.selectedEntry()?.name).toBe('Zig');
    expect(live.fetchPart).toHaveBeenCalledTimes(2); // sources a and b
    expect(app.ui.watchMsg).toMatch(/Tracking “Zig”/);
    expect(before).toBeGreaterThan(0);
  });
  it('refuses people, duplicates and a full channel, and says why', () => {
    expect(actions.addTopic('Elon Musk')).toBe(false);
    expect(app.ui.watchErr).toBe(true);
    expect(app.ui.watchMsg).toMatch(/looks like a person/);
    const lens = app.activeLens()!;
    expect(actions.addTopic(lens.topics[0].name.toUpperCase())).toBe(false);
    expect(app.ui.watchMsg).toMatch(/already in/);
    expect(actions.addTopic('One more')).toBe(false); // presets fill all six slots
    expect(app.ui.watchMsg).toMatch(/holds 6 topics/);
  });
  it('removes a topic and selects its neighbour', () => {
    const [first, second] = app.entriesOf(app.activeLens());
    actions.select(first.key);
    actions.removeTopic(first.key);
    expect(app.state.rt.has(first.key)).toBe(false);
    expect(app.selectedEntry()?.name).toBe(second.name);
  });
  it('switches stream, loading it only the first time', () => {
    actions.setStorySource('hn');
    expect(app.state.storySrc).toBe('hn');
    expect(stories.load).toHaveBeenCalledOnce();
    stories.status.at.hn = Date.now();
    actions.setStorySource('hn');
    expect(stories.load).toHaveBeenCalledOnce();
  });
  it('steps through topics and channels, wrapping around', () => {
    const list = app.entriesOf(app.activeLens());
    actions.select(list[list.length - 1].key);
    actions.shiftTopic(1);
    expect(app.selectedEntry()?.key).toBe(list[0].key);
    const i = app.state.lenses.findIndex(l => l.id === 'github');
    actions.shiftLens(1);
    expect(app.state.activeLens).toBe(app.state.lenses[(i + 1) % app.state.lenses.length].id);
  });
});

describe('contexts', () => {
  it('are independent: changing one app leaves another alone', () => {
    const a = createContext(),
      b = createContext();
    a.app.loadLenses();
    b.app.loadLenses();
    a.actions.selectLens('energy');
    expect(a.app.state.activeLens).toBe('energy');
    expect(b.app.state.activeLens).toBeNull();
    expect(a.app.state).not.toBe(b.app.state);
  });
});

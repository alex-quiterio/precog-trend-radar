// The shipped lenses, and upgrading saved lenses when they change.
import { beforeEach, describe, expect, it } from 'vitest';

import { LS } from '@core/config';
import { memoryBackend, useBackend } from '@core/storage';
import { loadLenses, state } from '@/state';

let mem = memoryBackend().data;

const saved = (id: string, names: string[]) => ({
  id,
  name: id,
  desc: '',
  topics: names.map((name, slot) => ({ name, slot })),
});

describe('lenses', () => {
  beforeEach(() => void (mem = useBackend(memoryBackend()).data));

  it('starts a first visit with one lens per channel', () => {
    loadLenses();
    expect(state.lenses.map(l => l.id)).toEqual([
      'world',
      'tgs',
      'energy',
      'portugal',
      'housing',
      'circular',
      'amsterdam',
      'marginalian',
      'github',
    ]);
    expect(state.lenses.every(l => l.lang === 'en')).toBe(true);
  });

  it('replaces the old presets on upgrade and keeps lenses the user made', () => {
    mem.set(LS.presetVer, '5');
    mem.set(
      LS.lenses,
      JSON.stringify([
        saved('geo', ['NATO', 'BRICS']),
        saved('tech', ['Rust']),
        saved('mine', ['Zig', 'Solarpunk']),
        saved('planet', ['Degrowth']),
      ]),
    );
    loadLenses();
    expect(state.lenses.map(l => l.id)).toEqual([
      'world',
      'tgs',
      'energy',
      'portugal',
      'housing',
      'circular',
      'amsterdam',
      'marginalian',
      'github',
      'mine',
    ]);
    expect(state.lenses.at(-1)?.topics.map(t => t.name)).toEqual(['Zig', 'Solarpunk']);
  });

  it('leaves saved lenses alone once they are on the current version', () => {
    loadLenses();
    mem.set(LS.lenses, JSON.stringify([saved('mine', ['Zig'])]));
    loadLenses();
    expect(state.lenses.map(l => l.id)).toEqual(['mine']);
  });

  it('saves the upgraded lenses straight away', () => {
    mem.set(LS.presetVer, '4');
    mem.set(LS.lenses, JSON.stringify([saved('geo', ['NATO'])]));
    loadLenses();
    expect(JSON.parse(mem.get(LS.lenses) || '[]').map((l: { id: string }) => l.id)).toContain('github');
  });

  it('repairs a browser marked as upgraded that still holds the old lenses', () => {
    mem.set(LS.presetVer, '7');
    mem.set(
      LS.lenses,
      JSON.stringify(
        ['world', 'tgs', 'portugal', 'circular', 'geo', 'climate', 'land', 'nl'].map(id => saved(id, ['X'])),
      ),
    );
    loadLenses();
    expect(state.lenses.map(l => l.id)).toEqual([
      'world',
      'tgs',
      'energy',
      'portugal',
      'housing',
      'circular',
      'amsterdam',
      'marginalian',
      'github',
    ]);
    loadLenses(); // and it sticks on the next load
    expect(state.lenses.map((l: { id: string }) => l.id)).toContain('github');
  });
});

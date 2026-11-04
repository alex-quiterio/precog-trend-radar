// Upgrading saved lenses when the shipped presets change.
import { beforeEach, describe, expect, it } from 'vitest';

const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: k => mem.get(k) ?? null,
  setItem: (k, v) => void mem.set(k, String(v)),
  removeItem: k => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

const { LS } = await import('../src/core/config');
const { lensAllows, loadLenses, state } = await import('../src/state');

const saved = (id: string, names: string[]) => ({
  id,
  name: id,
  desc: '',
  topics: names.map((name, slot) => ({ name, slot })),
});

describe('preset upgrade', () => {
  beforeEach(() => mem.clear());

  it('upgrades untouched presets, keeps customised ones, and adds the new lens', () => {
    mem.set(LS.presetVer, '2');
    mem.set(
      LS.lenses,
      JSON.stringify([
        saved('tech', ['AI agents', 'WebGPU', 'Rust', 'Solid-state batteries', 'Remote work']), // untouched v2 preset
        saved('circular', ['Circular economy', 'My own topic']), // customised by the user
        saved('portugal', [
          'Habitação',
          'Incêndios',
          'Seca',
          'Êxodo rural',
          'Permacultura',
          'Agricultura regenerativa',
        ]),
      ]),
    );
    loadLenses();
    const byId = Object.fromEntries(state.lenses.map(l => [l.id, l.topics.map(t => t.name)]));
    expect(byId.tech).toBeUndefined(); // the untouched Tech radar is replaced by Great Simplification
    expect(byId.tgs).toContain('Degrowth');
    expect(byId.circular).toEqual(['Circular economy', 'My own topic']);
    expect(byId.portugal).toContain('Alentejo');
    expect(state.lenses.map(l => l.id)).toContain('land');
  });

  it('keeps a Tech radar the user edited', () => {
    mem.set(LS.presetVer, '3');
    mem.set(LS.lenses, JSON.stringify([saved('tech', ['AI agents', 'Zig'])]));
    loadLenses();
    expect(state.lenses.find(l => l.id === 'tech')?.topics.map(t => t.name)).toEqual(['AI agents', 'Zig']);
  });

  it('starts a first visit with all eight preset lenses', () => {
    loadLenses();
    expect(state.lenses.map(l => l.id)).toEqual([
      'world',
      'geo',
      'climate',
      'circular',
      'portugal',
      'land',
      'nl',
      'tgs',
    ]);
  });
});

describe('lens sources', () => {
  beforeEach(() => mem.clear());

  it('scopes preset lenses: no GitHub or Hacker News for geopolitics, no Forecasts for Portugal', () => {
    loadLenses();
    expect(lensAllows('geo', 'github')).toBe(false);
    expect(lensAllows('geo', 'hn')).toBe(false);
    expect(lensAllows('geo', 'wikipedia')).toBe(true);
    expect(lensAllows('portugal', 'forecasts')).toBe(false);
    expect(lensAllows('portugal', 'soil')).toBe(true);
  });

  it('gives saved preset lenses their preset sources, and custom lenses every source', () => {
    mem.set(LS.presetVer, '4');
    mem.set(LS.lenses, JSON.stringify([saved('geo', ['NATO']), saved('mine', ['Zig'])]));
    loadLenses();
    expect(lensAllows('geo', 'github')).toBe(false);
    expect(lensAllows('mine', 'github')).toBe(true);
  });

  it('keeps sources the user chose', () => {
    mem.set(LS.presetVer, '4');
    mem.set(LS.lenses, JSON.stringify([{ ...saved('geo', ['NATO']), sources: ['wikipedia', 'github', 'bogus'] }]));
    loadLenses();
    expect(state.lenses[0].sources).toEqual(['wikipedia', 'github']);
  });
});

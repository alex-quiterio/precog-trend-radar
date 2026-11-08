// The composition root: each context is its own app, and panels reach it through useApp().
import { createApp } from 'vue';
import { beforeEach, describe, expect, it } from 'vitest';
import { memoryBackend, useBackend } from '@core/storage';
import { contextPlugin, createContext, useApp } from './context';

beforeEach(() => {
  useBackend(memoryBackend());
});

describe('createContext', () => {
  it('builds the app store with every service working on it', () => {
    const ctx = createContext();
    expect(Object.keys(ctx).sort()).toEqual(
      ['actions', 'app', 'datapoints', 'github', 'hot', 'live', 'myGithub', 'stories'].sort(),
    );
  });
  it('gives each context its own state', () => {
    const a = createContext(),
      b = createContext();
    a.app.loadLenses();
    a.app.state.activeLens = 'tgs';
    expect(b.app.state.activeLens).not.toBe('tgs');
  });
});

describe('useApp', () => {
  it('returns the context the plugin provided', () => {
    const ctx = createContext();
    const vue = createApp({}).use(contextPlugin(ctx));
    expect(vue.runWithContext(() => useApp())).toBe(ctx);
  });
  it('says what is missing when no context was provided', () => {
    expect(() => createApp({}).runWithContext(() => useApp())).toThrow(/needs the context/);
  });
});

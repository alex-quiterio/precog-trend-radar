// The optional GitHub token: kept in this browser, sent as a bearer token, and setting the search pace.
import { beforeEach, describe, expect, it } from 'vitest';
import { memoryBackend, useBackend } from '@core/storage';
import { githubHeaders, githubToken, searchGap, setGithubToken } from './auth';

beforeEach(() => {
  useBackend(memoryBackend());
});

describe('GitHub token', () => {
  it('without one: plain JSON headers, and searches paced for the anonymous limit', () => {
    expect(githubToken()).toBe('');
    expect(githubHeaders()).toEqual({ Accept: 'application/vnd.github+json' });
    expect(searchGap()).toBe(6500);
  });
  it('with one: trimmed, sent as a bearer token, and searches paced faster', () => {
    setGithubToken('  ghp_abc \n');
    expect(githubToken()).toBe('ghp_abc');
    expect(githubHeaders()).toEqual({ Accept: 'application/vnd.github+json', Authorization: 'Bearer ghp_abc' });
    expect(searchGap()).toBe(2100);
  });
  it('clears with an empty value', () => {
    setGithubToken('ghp_abc');
    setGithubToken('');
    expect(githubToken()).toBe('');
  });
});

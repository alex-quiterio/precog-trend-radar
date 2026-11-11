// Matching topics in text: phrases and whole words.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getText, HttpError, phrase, topicRegex, withTimeout } from '@sources/registry';

describe('withTimeout', () => {
  const any = AbortSignal.any;
  afterEach(() => {
    AbortSignal.any = any;
    vi.useRealTimers();
  });
  it('aborts after the time given, and when the signal it wraps does', async () => {
    const ctl = new AbortController();
    const timed = withTimeout(undefined, 20),
      wrapped = withTimeout(ctl.signal, 60e3);
    ctl.abort();
    expect(wrapped.aborted).toBe(true);
    expect(timed.aborted).toBe(false);
    await new Promise(r => setTimeout(r, 60)); // the browser's own timer: not one a test can wind forward
    expect(timed.aborted).toBe(true);
    expect(timed.reason.name).toBe('TimeoutError');
  });
  it('still times out in a browser without AbortSignal.any', () => {
    vi.useFakeTimers();
    // @ts-expect-error an older browser: the method is missing
    AbortSignal.any = undefined;
    const ctl = new AbortController();
    const timed = withTimeout(undefined, 1000),
      wrapped = withTimeout(ctl.signal, 1000);
    ctl.abort();
    expect(wrapped.aborted).toBe(true);
    expect(withTimeout(ctl.signal).aborted).toBe(true); // already cancelled
    vi.advanceTimersByTime(999);
    expect(timed.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(timed.aborted).toBe(true);
    expect(timed.reason.name).toBe('TimeoutError');
  });
});

describe('getText', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('answers the body as text, and throws the status of a failed reply', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, text: async () => 'a,b\n1,2\n' }));
    expect(await getText('https://example.org/file.csv')).toBe('a,b\n1,2\n');
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 404, text: async () => '' }));
    await expect(getText('https://example.org/file.csv')).rejects.toBeInstanceOf(HttpError);
  });
});

describe('phrase', () => {
  it('quotes multi-word topics and leaves query expressions alone', () => {
    expect(phrase('peak oil')).toBe('"peak oil"');
    expect(phrase('Hormuz')).toBe('Hormuz');
    expect(phrase('(solar OR wind)')).toBe('(solar OR wind)');
  });
});

describe('topicRegex', () => {
  it('matches whole words in any language, ignoring case', () => {
    expect(topicRegex('AI').test('How AI changes energy')).toBe(true);
    expect(topicRegex('AI').test('Said the chair')).toBe(false);
    expect(topicRegex('Wooncoöperatie').test('Een nieuwe wooncoöperatie in Noord')).toBe(true);
    expect(topicRegex('"peak oil"').test('After Peak Oil, what?')).toBe(true);
  });
});

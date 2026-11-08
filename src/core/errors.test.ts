// Reading caught errors.
import { describe, expect, it } from 'vitest';
import { errorText, isAbort } from './errors';

describe('isAbort', () => {
  it('knows a cancelled request, from an Error or a DOMException', () => {
    const e = new Error('stop');
    e.name = 'AbortError';
    expect(isAbort(e)).toBe(true);
    expect(isAbort(new DOMException('stop', 'AbortError'))).toBe(true);
  });
  it('is false for anything else', () => {
    expect(isAbort(new Error('HTTP 500'))).toBe(false);
    expect(isAbort(new DOMException('slow', 'TimeoutError'))).toBe(false);
    expect(isAbort('AbortError')).toBe(false);
    expect(isAbort(null)).toBe(false);
  });
});

describe('errorText', () => {
  it('gives the message of an error, or the thrown value as text', () => {
    expect(errorText(new Error('HTTP 429'))).toBe('HTTP 429');
    expect(errorText('offline')).toBe('offline');
    expect(errorText(42)).toBe('42');
  });
  it('never gives an empty message', () => {
    expect(errorText(new Error(''))).toBe('unknown error');
    expect(errorText('')).toBe('unknown error');
  });
});

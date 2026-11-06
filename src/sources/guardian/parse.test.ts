import { describe, expect, it } from 'vitest';
import search from './fixtures/search.json';
import { parseGuardianPage } from './parse';

// The fixture follows the documented content-search reply (open-platform.theguardian.com/documentation/search);
// a live one needs an API key.
describe('Guardian replies', () => {
  it('reads the page count and the results', () => {
    const { pages, results } = parseGuardianPage(search);
    expect(pages).toBe(4);
    expect(results.map(r => r.type)).toEqual(['article', 'liveblog']);
    expect(results[0]).toMatchObject({
      id: 'environment/2026/nov/05/heat-pump-installations-record',
      section: 'Environment',
      t: Date.parse('2026-11-05T14:02:11Z'),
    });
  });
  it('skips results without a valid date', () => {
    const reply = { response: { pages: 1, results: [{ id: 'a', webPublicationDate: 'soon' }] } };
    expect(parseGuardianPage(reply).results).toEqual([]);
  });
  it('refuses a reply without a response (e.g. an error page)', () => {
    expect(() => parseGuardianPage({ message: 'Unauthorized' })).toThrow(/unexpected format/);
  });
});

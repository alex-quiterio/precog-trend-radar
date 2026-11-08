// Matching topics in text: phrases and whole words.
import { describe, expect, it } from 'vitest';
import { phrase, topicRegex } from '@sources/registry';

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

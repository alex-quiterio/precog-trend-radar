// The person guard: PRECOG tracks topics, never people.
import { describe, expect, it } from 'vitest';
import { looksLikePerson } from '@core/guard';

describe('scope guard', () => {
  it.each([
    'Elon Musk',
    'satya nadella',
    '@someone',
    'me@example.com',
    'Dr. Jane Smith',
    'Mark Zuckerberg',
    'u/someone',
  ])('refuses %s', s => expect(looksLikePerson(s)).toBe(true));
  it.each([
    'AI agents',
    'Solid-state batteries',
    'Remote work',
    'Rust',
    'mark down',
    'Circular economy',
    'Habitação',
    'Stikstofcrisis',
  ])('accepts %s', s => expect(looksLikePerson(s)).toBe(false));
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseVpts, type MigrationDay } from '@sources/aloft/parse';
import { FLYWAY, flywayNotes, perKm, seasonOf, versus, type StationRead } from './migration';

const real = parseVpts(readFileSync(new URL('../sources/aloft/fixtures/ptlis-vpts.csv', import.meta.url), 'utf8'));
const day = (birdsPerKm: number, heading: number | null, on = '2026-11-06'): MigrationDay => ({
  ...real,
  day: on,
  birdsPerKm,
  heading,
});
/** Numbers are formatted in the reader's locale: compare with English thousands separators. */
const en = (t: string) => t.replace(/(\d)[.  \s](\d{3})/g, '$1,$2');
const route = (days: [number, number | null][], on?: string): StationRead[] =>
  FLYWAY.map((s, i) => ({ ...s, data: days[i] ? { day: day(days[i][0], days[i][1], on) } : undefined }));

describe('the flyway', () => {
  it('runs north to south, the North Sea to the Algarve, with a radar near each city', () => {
    expect(FLYWAY.map(s => s.site)).toEqual(['Borkum', 'Den Helder', 'Herwijnen', 'Porto', 'Coruche', 'Loulé']);
    expect(FLYWAY.filter(s => s.near).map(s => s.near)).toEqual(['Amsterdam', 'Lisbon']);
  });
  it('takes the season from the calendar, not from which way the birds happen to fly', () => {
    expect(['2026-04-10', '2026-09-01', '2026-11-06', '2026-01-15'].map(seasonOf)).toEqual([
      'spring',
      'autumn',
      'autumn',
      'winter',
    ]);
  });
  it('tells the autumn flow towards each country, upstream first', () => {
    const notes = flywayNotes(
      route([
        [400, 210],
        [1000, 200],
        [3120, 225],
        [8000, 200],
        [5000, 180],
        [600, 280],
      ]),
    ).map(en);
    expect(notes[0]).toBe(
      'Autumn passage: birds head south and south-west, towards Iberia and Africa. 5 of 6 radars see birds heading south.',
    );
    expect(notes[1]).toBe(
      'Towards the Netherlands: 400 per km over Borkum, 1,000 per km over Den Helder, then 3,100 per km over Herwijnen, near Amsterdam, heading SW.',
    );
    expect(notes[2]).toBe(
      'Towards Portugal: 8,000 per km over Porto, then 5,000 per km over Coruche, near Lisbon, heading S.',
    );
    expect(notes[3]).toBe('Busiest: Porto (Portugal), 8,000 per km.');
  });
  it('turns around in spring: into Portugal from the Algarve, then the Netherlands', () => {
    const notes = flywayNotes(
      route(
        [
          [100, 20],
          [200, 10],
          [300, 30],
          [400, 0],
          [500, 350],
          [600, 15],
        ],
        '2026-04-10',
      ),
    );
    expect(notes[0]).toMatch(/^Spring passage: .* 6 of 6 radars see birds heading north\.$/);
    expect(notes[1]).toBe(
      'Towards Portugal: 600 per km over Loulé, then 500 per km over Coruche, near Lisbon, heading N.',
    );
    expect(notes[2]).toBe('Towards the Netherlands: 300 per km over Herwijnen, near Amsterdam, heading NNE.');
  });
  it('leaves out radars that saw nothing, and says nothing before any answered', () => {
    expect(flywayNotes(route([]))).toEqual([]);
    expect(flywayNotes(route([[0, null]]))).toEqual([]);
    const notes = flywayNotes(
      route([
        [0, null],
        [0, null],
        [300, 200],
      ]),
    ).map(en);
    expect(notes[1]).toBe('Towards the Netherlands: 300 per km over Herwijnen, near Amsterdam, heading SSW.');
  });
  it('compares a night with the one before', () => {
    expect(versus({ day: day(2000, 200), prev: day(1000, 200) }).text).toBe('2× the night before');
    expect(versus({ day: day(1300, 200), prev: day(1000, 200) })).toEqual({
      text: '+30% on the night before',
      dir: 'up',
    });
    expect(versus({ day: day(400, 200), prev: day(1000, 200) }).dir).toBe('down');
    expect(versus({ day: day(1000, 200) }).text).toBe('');
  });
  it('rounds birds to what a radar can tell', () => {
    expect([perKm(87), perKm(3149), perKm(12_345)].map(en)).toEqual(['90 per km', '3,100 per km', '12,300 per km']);
  });
});

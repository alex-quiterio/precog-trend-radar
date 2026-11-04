// The person filter for forecast questions: topics stay, named people go.
import { describe, expect, it } from 'vitest';
import { mentionsPerson } from '../src/sources/manifold';

describe('mentionsPerson', () => {
  it('keeps questions about topics, places and institutions', () => {
    for (const q of [
      'Will Russia and Ukraine sign a ceasefire before 2027?',
      'Will NATO invoke Article 5 in 2026?',
      'Will the Strait of Hormuz reopen to tanker traffic by December 31?',
      'Will Brent crude close above $120 this year?',
      'Will there be a food shortage related to the closure of the Strait of Hormuz?',
    ])
      expect(mentionsPerson(q), q).toBe(false);
  });
  it('drops questions that name a person', () => {
    for (const q of [
      'Will Trump impose new tariffs on the EU?',
      "Will Putin's government fall by 2027?",
      'Will Elon Musk step down as CEO?',
      'Will President Lula visit Lisbon?',
      'Will @someone post again?',
    ])
      expect(mentionsPerson(q), q).toBe(true);
  });
});

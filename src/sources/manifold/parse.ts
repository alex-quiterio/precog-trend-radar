// PRECOG / Trend Radar · Manifold: reading market-search replies, and the person filter for questions.
import { at, list, num, str } from '@sources/shape';
import { looksLikePerson } from '@core/guard';

export interface Forecast {
  id: string;
  question: string;
  url: string;
  prob: number;
  bettors: number;
  vol24: number;
  closes: number;
}

// Surnames that headline markets on their own ("Will Putin …"); the first-name guard can't see these.
const SURNAMES = new Set(
  'trump biden harris vance obama putin zelensky zelenskyy netanyahu xi jinping modi macron merz scholz starmer sunak meloni milei erdogan orban musk bezos zuckerberg altman khamenei kim lula montenegro'.split(
    ' ',
  ),
);
/** True when the text names a person: a known surname, a title, a handle, or a 2–3-word name. */
export function mentionsPerson(text: string): boolean {
  // "Will" opens most questions, and the guard would read "Will Russia" as a name.
  const words = String(text)
    .replace(/^(will|would|does|is|are|can|did|has|have)\s+/i, '')
    .split(/[\s,;:?!()"“”’'.]+/)
    .filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (/^@\w/.test(words[i]) || SURNAMES.has(words[i].toLowerCase().replace(/'s$/, ''))) return true;
    for (const n of [2, 3]) {
      const run = words.slice(i, i + n);
      if (run.length === n && run.every(w => /^\p{Lu}/u.test(w)) && looksLikePerson(run.join(' '))) return true;
    }
  }
  return /\b(President|Senator|Prime Minister|Chancellor|CEO|King|Queen|Pope)\s+\p{Lu}/u.test(text);
}

/**
 * Manifold's search reply as forecasts worth showing: open, resolving after `now`, with a probability,
 * at least 10 forecasters, and a question that names no person.
 */
export function parseMarkets(reply: unknown, now = Date.now()): Forecast[] {
  return list(reply, 'Manifold').flatMap(m => {
    const prob = num(at(m, 'probability')),
      bettors = num(at(m, 'uniqueBettorCount')) ?? 0,
      closes = num(at(m, 'closeTime')),
      question = str(at(m, 'question')).trim();
    if (prob == null || bettors < 10 || closes == null || closes <= now || !question || mentionsPerson(question))
      return [];
    return [
      {
        id: 'mf:' + str(at(m, 'id')),
        question,
        url: str(at(m, 'url')),
        prob,
        bettors,
        vol24: num(at(m, 'volume24Hours')) ?? 0,
        closes,
      },
    ];
  });
}

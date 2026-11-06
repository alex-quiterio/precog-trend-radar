# Adding a data source

PRECOG reads public APIs from the browser. Each source lives in its own folder under `src/sources/`, and every
source follows the same split:

```
src/sources/<name>/
├── index.ts          fetching: URLs, caching, rate limits, registering a trend source (if it is one)
├── parse.ts          reading the reply: pure functions from `unknown` to typed values, no fetching
├── stream.ts         registering a stream (if it has one)
├── cards.ts          registering open-data cards (if it has any)
├── parse.test.ts     tests for parse.ts against saved replies
└── fixtures/         real replies, trimmed to a few records (*.json)
```

Every module that registers something is imported once, from **`src/sources/index.ts`**. That one list is how
the app finds its sources: adding a source means its folder plus a line there.

Shared pieces sit next to the folders:

| File                      | What it gives you                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/sources/registry.ts` | `registerAdapter`, `getJSON` (returns `unknown`), `HttpError`, `pool`, `phrase`, `utcDay`, `SKIP`    |
| `src/sources/shape.ts`    | `at`, `obj`, `list`, `num`, `str`, `objOr`, `listOr`, `ShapeError`: read a reply without trusting it |
| `src/sources/blend.ts`    | the attention index that combines trend sources                                                      |
| `src/sources/streams.ts`  | `registerStream`, `StreamRow`, and `when`, `checked`, `inScope` for building rows                    |
| `src/sources/cards.ts`    | `registerCards`, `DatapointRow`, `DatapointFacts`                                                    |

Import with the path aliases: `@sources/…`, `@core/…`, `@features/…`, `@components/…`, and `@/…` for the
top-level modules (`@/types`, `@/state`). Only a file's sibling stays relative (`./parse`).

There are three kinds of source. Pick the one that matches what the data is.

| Kind             | It answers                                      | Shows up as                                    | Examples                         |
| ---------------- | ----------------------------------------------- | ---------------------------------------------- | -------------------------------- |
| **Trend source** | how much attention a topic got, per day         | a line in the attention index on every channel | Wikipedia, Hacker News, Guardian |
| **Context card** | one number worth knowing, with a little history | a card in a channel's Open data panel          | ECB, Eurostat, IPMA, Open-Meteo  |
| **Stream**       | items to read about the channel's topics        | a tab in Streams                               | Manifold, Reading (WordPress)    |

## The rules every source keeps

- **Topics, never people.** Query by topic only. If a lookup can land on a person (a Wikipedia article, a
  forecast question), drop it with `looksLikePerson` from `@core/guard`.
- **Never trust a reply.** `getJSON` returns `unknown`. Read it in `parse.ts` with the `shape.ts` helpers. When
  the part you rely on is missing, throw `ShapeError` (via `obj`/`list`, or directly): the panel then says
  "X answered in an unexpected format" instead of drawing wrong numbers. Skip single bad records instead of
  failing the whole reply.
- **Respect `signal`.** Pass it to every request so a newer refresh can cancel the old one.
- **Be gentle.** Cache in `localStorage` through `store` from `@core/config` (per day, or per hour for fast
  data), and keep within the API's rate limits (see the queues in `guardian/index.ts` and `features/github.ts`).
- **Keys stay in the browser.** If the API needs a key, ask for it in the UI and keep it in `localStorage`, like
  the Guardian key. Never put a key in the source.
- **Check it on a phone.** Many people read PRECOG on a phone: look at any new card or tab at 375px wide.

## 1. A trend source

An adapter returns attention points (one value per day) for one topic. Example: npm downloads per day.

**`src/sources/npm/parse.ts`**: read the reply.

```ts
// PRECOG / Trend Radar · npm: reading the downloads-range reply.
import { at, list, num, str } from '@sources/shape';

/** npm's downloads range reply as daily points. Days without a count are skipped. */
export function parseDownloads(reply: unknown): { t: string; value: number }[] {
  return list(at(reply, 'downloads'), 'npm', 'downloads').flatMap(d => {
    const day = str(at(d, 'day')),
      value = num(at(d, 'downloads'));
    return /^\d{4}-\d{2}-\d{2}$/.test(day) && value != null ? [{ t: `${day}T00:00:00Z`, value }] : [];
  });
}
```

**`src/sources/npm/index.ts`**: fetch, then register.

```ts
// PRECOG / Trend Radar · npm downloads per day for packages named after the topic.
import { SKIP, getJSON, registerAdapter } from '@sources/registry';
import { parseDownloads } from './parse';
export * from './parse';

registerAdapter({
  id: 'npm',
  label: 'npm downloads / day',
  unit: 'downloads',
  concurrency: 4, // requests in flight at once
  weight: 0.2, // its share in the blend
  minMean: 1, // below this daily mean the source counts as sparse and gets less weight
  async fetch(topic, { signal, query }) {
    if (!/^[a-z0-9-]+$/i.test(query.q)) return SKIP(topic, 'not an npm package name');
    const reply = await getJSON(
      `https://api.npmjs.org/downloads/range/last-month/${encodeURIComponent(query.q)}`,
      signal,
    );
    return { topic, points: parseDownloads(reply) };
  },
});
```

Then wire it in:

1. `src/sources/index.ts`: add `import '@sources/npm';` with the other trend sources (importing it registers it).
2. `src/sources/registry.ts`: add `'npm'` to `SOURCES.blend.parts` to blend it into every channel's lines.
3. `src/core/format.ts`: add a short name to `COMP_LABEL` (`npm: 'npm'`), used in the chart's source chips.

What `fetch` may do:

- Return `{ topic, points }`. Points need `t` (an ISO string or milliseconds) and `value`; PRECOG sorts them,
  drops bad ones and keeps the last 90.
- Return `SKIP(topic, 'reason')` when the source doesn't apply (a non-English lens, a missing key). The reason
  shows as a grey chip, not an error.
- Throw an `Error` with a short message when there is no data. It shows on the chip for that source.

You can also register an adapter at runtime, without a build, from the browser console:
`PRECOG.registerAdapter({ id, label, fetch })`.

## 2. A context card

A card is a number with a label, a source line and an optional small chart. Example: the ECB deposit rate.

1. **Parse** in `src/sources/<provider>/parse.ts` (see `ecb/parse.ts`): a pure function from `unknown` to the
   values the card needs, throwing `ShapeError` when they are missing.
2. **Register a loader** in `src/sources/<provider>/cards.ts`. One loader per request, so they fail on their own:
   a loader that throws only leaves its own cards out.

   ```ts
   // PRECOG / Trend Radar · ECB cards.
   import { nf2 } from '@core/format';
   import { registerCards } from '@sources/cards';
   import { getJSON } from '@sources/registry';
   import { parseEcbLatest } from './parse';

   registerCards({
     id: 'ecb-deposit-rate',
     async load() {
       const { value, since } = parseEcbLatest(await getJSON('https://data-api.ecb.europa.eu/…'));
       return [
         {
           group: 'ea', // which heading it sits under: 'pt', 'nl', 'ea' or 'planet'
           id: 'ecb', // channels pick cards by this id
           k: 'ECB deposit rate',
           v: `${nf2.format(value)}%`,
           src: `ECB Data Portal · since ${since}`,
           href: 'https://data.ecb.europa.eu/',
           o: 1, // order within the group
           // spark: a SeriesPoint[] for the small chart
         },
       ];
     },
   });
   ```

   A loader whose numbers the gist also reads returns `{ rows, facts }` instead (see `ipma/cards.ts`).

3. **Register the module**: add `import '@sources/ecb/cards';` to `src/sources/index.ts`.
4. **Show it** in `src/channels.ts`: add the card's `id` to the `datapoints` list of each channel that should
   show it. Country channels only show their own country's cards.

## 3. A stream

A stream is a tab under "Matched to your topics": items (articles, forecasts, posts) that name the topics in
scope. Every stream's rows are drawn the same way, so a stream never touches the panel. Start from the closest
one: `manifold/stream.ts` (a keyless search API) or `reading/stream.ts` (a list of sites).

1. **Parse** the search reply in `src/sources/<name>/parse.ts`, and fetch it in `index.ts` with a short
   in-memory or `localStorage` cache.
2. **Register the stream** in `src/sources/<name>/stream.ts`. It keeps what it loads in its own `shallowRef`, and
   its `view` turns that into rows:

   ```ts
   registerStream({
     id: 'papers',
     label: 'Papers',
     // available: () => ui.someKey, // hide the tab until it can work
     async load(ctx, signal) {
       // ctx.entries: the topics in scope. Search each, keep matches with the topic keys they name.
       found.value = await searchPapers(ctx.entries, signal);
     },
     view(ctx, at) {
       const list = [...found.value.values()].filter(p => inScope(p.topics, ctx).length);
       return {
         rows: list.slice(0, 12).map(p => ({
           id: p.id,
           title: p.title,
           url: p.url,
           topics: p.topics, // the panel shows up to two in scope as chips
           meta: [{ text: p.journal, cls: 'site' }, when(p.t)], // labels under the title
           side: { big: String(p.citations), unit: 'cites', note: 'Crossref' }, // the figure on the right
           bar: 100, // 0–100
         })),
         meta: checked(at, 'papers naming your topics'),
         empty: 'No recent papers name these topics.',
       };
     },
   });
   ```

   Match items to topics with `topicRegex(queryOf(E).q)` and record `E.key` for each topic an item names.
   Throw from `load` to show "Could not load: …"; return a partial failure from `warning()` to show it under the
   rows. Loading, errors and timing are handled for you in `features/stories.ts`.

3. **Register the module**: add `import '@sources/<name>/stream';` to `src/sources/index.ts`.
4. **Show it** in `src/channels.ts`: add the id to the `streams` of the channels that should show it, in the
   order the tabs should appear.

## Testing a source

Every `parse.ts` gets a `parse.test.ts` next to it that reads saved replies from `fixtures/`:

```ts
import { describe, expect, it } from 'vitest';
import downloads from './fixtures/downloads.json';
import { parseDownloads } from './parse';

describe('npm replies', () => {
  it('reads daily downloads', () => {
    expect(parseDownloads(downloads)[0]).toEqual({ t: '2026-10-07T00:00:00Z', value: 1234 });
  });
  it('refuses a reply without downloads (e.g. an error object)', () => {
    expect(() => parseDownloads({ error: 'package not found' })).toThrow(/unexpected format/);
  });
});
```

To make a fixture, save a real reply and trim it to a few records (and any long text to a few hundred
characters, cut at a tag boundary for HTML). If the API needs a key, write the fixture by hand from the API's
documentation and say so in a comment, as `guardian/parse.test.ts` does.

Test at least: a real reply, a record with a missing field (skipped, not a crash), and a reply of the wrong
shape (a `ShapeError`). Then run:

```sh
npm test       # Vitest: tests/ and every src/**/*.test.ts
npm run lint   # strict type-check and Prettier
npm run build  # what CI runs before deploying
```

// PRECOG / Trend Radar · Hacker News (Algolia): reading search replies.
import { ShapeError, at, listOr, num, obj, str } from '@sources/shape';

/** Algolia's hit count (nbHits) for a search; a reply without one is not an Algolia reply. */
export function parseHitCount(reply: unknown): number {
  const n = num(obj(reply, 'Hacker News').nbHits);
  if (n == null) throw new ShapeError('Hacker News', 'no hit count');
  return n;
}
/** A story from Algolia's story search. */
export interface StoryHit {
  objectID: string;
  title: string;
  /** The story's link; empty for Ask/Show HN posts, which only live on HN. */
  url: string;
  t: number;
  points: number;
  comments: number;
}
/** The stories of an Algolia search reply. Hits without an id, title or time are skipped. */
export const parseStoryHits = (reply: unknown): StoryHit[] =>
  listOr(at(reply, 'hits')).flatMap(h => {
    const objectID = str(at(h, 'objectID')),
      title = str(at(h, 'title')),
      created = num(at(h, 'created_at_i'));
    if (!objectID || !title || created == null) return [];
    return [
      {
        objectID,
        title,
        url: str(at(h, 'url')),
        t: created * 1000,
        points: num(at(h, 'points')) ?? 0,
        comments: num(at(h, 'num_comments')) ?? 0,
      },
    ];
  });
/** Creation times (ms) of the hits in an Algolia reply. */
export const parseHitTimes = (reply: unknown): number[] =>
  listOr(at(reply, 'hits')).flatMap(h => {
    const s = num(at(h, 'created_at_i'));
    return s == null ? [] : [s * 1000];
  });

// PRECOG / Trend Radar · Reading API replies safely. Every reply arrives as `unknown`; these helpers check
// the shape PRECOG relies on, so a changed or broken API shows a clear error instead of wrong numbers.

/** An API answered in a shape PRECOG doesn't recognise. */
export class ShapeError extends Error {
  constructor(source: string, detail: string) {
    super(`${source} answered in an unexpected format (${detail})`);
    this.name = 'ShapeError';
  }
}
export type Obj = Record<string, unknown>;
export const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
/** The value as an object, or a ShapeError naming what was expected. */
export function obj(v: unknown, source: string, what = 'reply'): Obj {
  if (!isObj(v)) throw new ShapeError(source, `${what} is not an object`);
  return v;
}
/** The value as a list, or a ShapeError naming what was expected. */
export function list(v: unknown, source: string, what = 'reply'): unknown[] {
  if (!Array.isArray(v)) throw new ShapeError(source, `${what} is not a list`);
  return v;
}
/** A field that may be missing: an object (or an empty one), a list (or an empty one). */
export const objOr = (v: unknown): Obj => (isObj(v) ? v : {});
export const listOr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** A finite number (numeric strings count), or null. */
export function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
/** A string, or '' for anything else. */
export const str = (v: unknown): string => (typeof v === 'string' ? v : '');
/** A path into nested objects: at(j, 'response', 'results'). Missing steps give undefined. */
export function at(v: unknown, ...path: (string | number)[]): unknown {
  let cur = v;
  for (const k of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[k];
  }
  return cur;
}

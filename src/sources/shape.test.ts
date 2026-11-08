// Reading API replies safely: a broken reply gives a clear error, never wrong numbers.
import { describe, expect, it } from 'vitest';
import { ShapeError, at, isObj, list, listOr, num, obj, objOr, str } from './shape';

describe('obj and list', () => {
  it('pass the right shape through', () => {
    const o = { a: 1 },
      l = [1];
    expect(obj(o, 'X')).toBe(o);
    expect(list(l, 'X')).toBe(l);
  });
  it('name the source and what was expected when the shape is wrong', () => {
    expect(() => obj([], 'ECB', 'series')).toThrow(new ShapeError('ECB', 'series is not an object'));
    expect(() => list({}, 'IPMA')).toThrow('IPMA answered in an unexpected format (reply is not a list)');
    expect(() => obj(null, 'X')).toThrow(ShapeError);
  });
});

describe('optional fields', () => {
  it('objOr and listOr give an empty value for a missing or wrong field', () => {
    expect(objOr(undefined)).toEqual({});
    expect(objOr([1])).toEqual({});
    expect(listOr({ a: 1 })).toEqual([]);
    expect(listOr([1, 2])).toEqual([1, 2]);
  });
  it('isObj is true for plain objects only', () => {
    expect([{}, [], null, 'x', 1].map(isObj)).toEqual([true, false, false, false, false]);
  });
});

describe('num and str', () => {
  it('num reads finite numbers and numeric strings, and gives null for the rest', () => {
    expect(num(2.5)).toBe(2.5);
    expect(num(' 3 ')).toBe(3);
    expect(num('')).toBeNull();
    expect(num('n/a')).toBeNull();
    expect(num(Infinity)).toBeNull();
    expect(num(null)).toBeNull();
  });
  it('str gives strings, and an empty one for anything else', () => {
    expect(str('a')).toBe('a');
    expect(str(1)).toBe('');
    expect(str(undefined)).toBe('');
  });
});

describe('at', () => {
  it('walks nested objects and lists', () => {
    const j = { response: { results: [{ id: 'x' }] } };
    expect(at(j, 'response', 'results', 0, 'id')).toBe('x');
  });
  it('gives undefined for a missing step, however deep', () => {
    expect(at({ a: 1 }, 'a', 'b', 'c')).toBeUndefined();
    expect(at(null, 'a')).toBeUndefined();
  });
});

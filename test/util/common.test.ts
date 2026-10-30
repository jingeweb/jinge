import {
  arrayEqual,
  arrayPushIfNotExist,
  arrayRemove,
  classnames,
  cx,
  isArray,
  isBoolean,
  isFunction,
  isNumber,
  isObject,
  isPromise,
  isString,
  isSymbol,
  isUndefined,
  typeOf,
  uid,
} from '../../src/util';
import { jestApi } from '../_helper';

test.each([
  [0, true],
  [-1, true],
  [0.5, true],
  [NaN, false],
  [Infinity, false],
  [-Infinity, false],
  ['1', false],
  [null, false],
])('isNumber(%p) accepts only finite numbers', (value, expected) =>
  expect(isNumber(value)).toBe(expected),
);
test('type guards distinguish null, primitives, arrays and callable values', () => {
  expect(isObject(null)).toBe(false);
  expect(isObject({})).toBe(true);
  expect(isObject([])).toBe(true);
  expect(isArray([])).toBe(true);
  expect(isArray({ length: 0 })).toBe(false);
  expect(isString('')).toBe(true);
  expect(isString(1)).toBe(false);
  expect(isSymbol(Symbol())).toBe(true);
  expect(isSymbol('symbol')).toBe(false);
  expect(isUndefined(undefined)).toBe(true);
  expect(isUndefined(null)).toBe(false);
  expect(isBoolean(false)).toBe(true);
  expect(isBoolean(new Boolean(false))).toBe(true);
  expect(isBoolean(0)).toBe(false);
  expect(isFunction(() => {})).toBe(true);
  expect(isFunction({})).toBe(false);
  expect(typeOf(null)).toBe('object');
});
test('isPromise accepts thenables and rejects non-callable then properties', () => {
  expect(isPromise(Promise.resolve())).toBe(true);
  // oxlint-disable-next-line unicorn/no-thenable -- Intentionally verify thenable detection.
  expect(isPromise({ then: () => {} })).toBe(true);
  // oxlint-disable-next-line unicorn/no-thenable -- Intentionally verify thenable detection.
  expect(isPromise({ then: true })).toBe(false);
  expect(isPromise(null)).toBe(false);
});
test('classnames combines trimmed strings and enabled object entries', () => {
  expect(
    classnames(
      ' base ',
      false,
      undefined,
      null,
      { ' active ': true, hidden: false, zero: 0 as unknown as boolean },
      '',
      'size',
    ),
  ).toBe('base active size');
  expect(cx).toBe(classnames);
});
test('array helpers preserve order, compare identities and remove only one occurrence', () => {
  const item = {};
  const other = {};
  const items = [item, item, other];
  expect(arrayRemove(items, item)).toBe(true);
  expect(items).toEqual([item, other]);
  expect(arrayRemove(items, {})).toBe(false);
  arrayPushIfNotExist(items, item);
  expect(items).toHaveLength(2);
  arrayPushIfNotExist(items, {});
  expect(items).toHaveLength(3);
  expect(arrayEqual([item], [item])).toBe(true);
  expect(arrayEqual([item], [other])).toBe(false);
  expect(arrayEqual([1], [1, 2])).toBe(false);
  expect(arrayEqual([], [])).toBe(true);
});
test('uid changes with time and random input', () => {
  jestApi.spyOn(Date, 'now').mockReturnValue(1000);
  jestApi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.5);
  try {
    expect(uid()).not.toBe(uid());
  } finally {
    jestApi.restoreAllMocks();
  }
});

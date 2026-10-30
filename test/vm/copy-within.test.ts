import { vm, vmWatch } from '../../src';
import { cleanupWith, flushUpdates, jestApi, setupRuntimeTests } from '../_helper';

setupRuntimeTests();
test.each<number[]>([
  [1, 0, 3],
  [0, 1],
  [2, 0, 2],
  [-2, 0],
  [-99, 1, 99],
  [99, 0],
  [1, 0, 0],
  [NaN, 1],
  [Infinity, 0],
  [-Infinity, 1],
  [1.8, 0.8, 3.8],
  [1, -Infinity, Infinity],
])('copyWithin matches native bounds and overlap handling: %j', (...args) => {
  const expected = [1, 2, 3, 4];
  Reflect.apply(expected.copyWithin, expected, args);
  const array = vm([1, 2, 3, 4]);
  expect(Reflect.apply(array.copyWithin, array, args)).toBe(array);
  expect([...array]).toStrictEqual(expected);
  expect(Object.keys(array)).toEqual(Object.keys(expected));
});
test('copyWithin copies sparse holes without turning them into undefined properties', () => {
  const raw = [1, 2, 3, 4];
  Reflect.deleteProperty(raw, '1');
  const expected = raw.slice();
  expected.copyWithin(0, 1, 3);
  const array = vm(raw);
  array.copyWithin(0, 1, 3);
  expect(0 in array).toBe(false);
  expect([...array]).toStrictEqual([...expected]);
  expect(Object.keys(array)).toEqual(Object.keys(expected));
});
test('copying a hole detaches the overwritten object and notifies its index', async () => {
  const raw: { n: number }[] = [{ n: 1 }, { n: 2 }, { n: 3 }];
  Reflect.deleteProperty(raw, '1');
  const array = vm(raw);
  const old = array[0];
  const index = jestApi.fn();
  const deep = jestApi.fn();
  cleanupWith(vmWatch(array, 0, index));
  cleanupWith(vmWatch(array, deep));
  array.copyWithin(0, 1, 2);
  await flushUpdates();
  expect(index).toHaveBeenCalledWith(undefined, old, undefined);
  expect(0 in array).toBe(false);
  deep.mockClear();
  old.n = 9;
  await flushUpdates();
  expect(deep).not.toHaveBeenCalled();
});
test('overlapping copies update notifications for every copied child alias', async () => {
  const array = vm([{ n: 1 }, { n: 2 }, { n: 3 }]);
  const removed = array[2];
  array.copyWithin(1, 0, 2);
  await flushUpdates();
  const first = jestApi.fn();
  const second = jestApi.fn();
  const third = jestApi.fn();
  cleanupWith(vmWatch(array, [0, 'n'], first));
  cleanupWith(vmWatch(array, [1, 'n'], second));
  cleanupWith(vmWatch(array, [2, 'n'], third));
  array[0].n = 10;
  await flushUpdates();
  expect(first).toHaveBeenCalledWith(10, 1, [0, 'n']);
  expect(second).toHaveBeenCalledWith(10, 1, [1, 'n']);
  expect(third).not.toHaveBeenCalled();
  removed.n = 99;
  await flushUpdates();
  expect(third).not.toHaveBeenCalled();
  array[2].n = 20;
  await flushUpdates();
  expect(third).toHaveBeenCalledWith(20, 2, [2, 'n']);
});

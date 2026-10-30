import { type ViewModel, VM_PARENTS, vm, vmWatch } from '../../src';
import { cleanupWith, flushUpdates, jestApi, setupRuntimeTests } from '../_helper';
setupRuntimeTests();

test.each<[string, number[]]>([
  ['no arguments', []],
  ['negative start', [-1, 1]],
  ['very negative start', [-99, 1]],
  ['start beyond length', [99, 1, 8]],
  ['fractional start', [1.8, 1.8, 8]],
  ['oversized deletion', [1, 99, 8]],
  ['negative deletion', [1, -1, 8]],
  ['NaN start', [NaN, 1]],
  ['infinite start', [Infinity, 1, 8]],
  ['negative infinite start', [-Infinity, 1]],
  ['infinite deletion', [1, Infinity]],
  ['omitted deletion', [1]],
])('splice matches native behavior: %s', (_, args) => {
  const expected = [1, 2, 3];
  const actual = vm([1, 2, 3]);
  const nativeRemoved = Reflect.apply(Array.prototype.splice, expected, args) as number[];
  const removed = Reflect.apply(actual.splice, actual, args) as number[];
  expect([...removed]).toEqual(nativeRemoved);
  expect([...actual]).toEqual(expected);
});
test('explicit undefined deleteCount differs from an omitted deleteCount', () => {
  const actual = vm([1, 2, 3]);
  expect(actual.splice(1, undefined)).toEqual([]);
  expect([...actual]).toEqual([1, 2, 3]);
  expect(actual.splice(undefined as unknown as number)).toEqual([1, 2, 3]);
  expect(actual).toHaveLength(0);
});
test('splice normalizes parent indexes for removed and surviving child objects', async () => {
  const array = vm([{ n: 1 }, { n: 2 }, { n: 3 }]);
  const removedItem = array[1];
  const tail = array[2];
  const callback = jestApi.fn();
  cleanupWith(vmWatch(array, [1, 'n'], callback));
  const removed = array.splice(-2, 1);
  expect(removed[0]).toBe(removedItem);
  expect(
    (removedItem as unknown as ViewModel)[VM_PARENTS]?.has(array as unknown as ViewModel),
  ).toBe(false);
  expect((tail as unknown as ViewModel)[VM_PARENTS]?.get(array as unknown as ViewModel)).toEqual(
    new Set([1]),
  );
  await flushUpdates();
  callback.mockClear();
  tail.n = 4;
  await flushUpdates();
  expect(callback).toHaveBeenCalledWith(4, 3, [1, 'n']);
});
test.each<[number | undefined, number | undefined]>([
  [-1, 5],
  [-99, 2],
  [1, 99],
  [1.9, 2.9],
  [NaN, NaN],
  [Infinity, Infinity],
  [-Infinity, Infinity],
  [0, -1],
  [undefined, undefined],
])('fill matches native bounds: start=%p end=%p', (start, end) => {
  const expected = [1, 2, 3];
  expected.fill(9, start, end);
  const actual = vm([1, 2, 3]);
  expect(actual.fill(9, start, end)).toBe(actual);
  expect([...actual]).toEqual(expected);
  expect(Object.keys(actual)).toEqual(Object.keys(expected));
});
test('fill normalizes indexes before detaching and linking child objects', () => {
  const array = vm([{ n: 1 }, { n: 2 }, { n: 3 }]);
  const replaced = array[2];
  const value = vm({ n: 9 });
  array.fill(value, -1, 99);
  expect(array).toHaveLength(3);
  expect(array[2]).toBe(value);
  expect((replaced as unknown as ViewModel)[VM_PARENTS]?.has(array as unknown as ViewModel)).toBe(
    false,
  );
  expect((value as unknown as ViewModel)[VM_PARENTS]?.get(array as unknown as ViewModel)).toEqual(
    new Set([2]),
  );
});
test('index extension coalesces index and length notifications', async () => {
  const array = vm([1]);
  const length = jestApi.fn();
  const index = jestApi.fn();
  cleanupWith(vmWatch(array, 'length', length));
  cleanupWith(vmWatch(array, 1, index));
  array[1] = 2;
  await flushUpdates();
  expect(length).toHaveBeenCalledTimes(1);
  expect(length.mock.calls[0].slice(0, 2)).toEqual([2, 1]);
  expect(index).toHaveBeenCalledTimes(1);
  expect(index.mock.calls[0].slice(0, 2)).toEqual([2, undefined]);
});

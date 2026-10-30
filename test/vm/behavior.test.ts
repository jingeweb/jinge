import {
  type ViewModel,
  VM_PARENTS,
  destroyViewModelCore,
  getValueByPath,
  isViewModel,
  vm,
  vmIgnore,
  vmRaw,
  vmWatch,
} from '../../src';
import { cleanupWith, flushUpdates, jestApi, setupRuntimeTests } from '../_helper';
setupRuntimeTests();
test('watch batches scalar changes and reports the previous value', async () => {
  const state = vm({ n: 0 });
  const callback = jestApi.fn();
  cleanupWith(vmWatch(state, 'n', callback));
  state.n = 1;
  state.n = 2;
  state.n = 3;
  await flushUpdates();
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(3, 0, ['n']);
});
test('watch does not emit when a value returns to its original value before delivery', async () => {
  const state = vm({ n: 0 });
  const callback = jestApi.fn();
  cleanupWith(vmWatch(state, 'n', callback));
  state.n = 1;
  state.n = 0;
  await flushUpdates();
  expect(callback).not.toHaveBeenCalled();
});
test('cancelling a watcher also cancels its queued callback', async () => {
  const state = vm({ n: 0 });
  const callback = jestApi.fn();
  const cancel = vmWatch(state, 'n', callback);
  state.n = 1;
  cancel();
  await flushUpdates();
  expect(callback).not.toHaveBeenCalled();
});
test('deep watch reports descendant changes while a shallow object watch does not', async () => {
  const state = vm({ child: { n: 0 } });
  const shallow = jestApi.fn();
  const deep = jestApi.fn();
  cleanupWith(vmWatch(state, 'child', shallow));
  cleanupWith(vmWatch(state, 'child', deep, { deep: true }));
  state.child.n = 1;
  await flushUpdates();
  expect(shallow).not.toHaveBeenCalled();
  expect(deep).toHaveBeenCalledWith(state.child, state.child, ['child', 'n']);
});
test('path watchers follow replaced ancestors and ignore detached children', async () => {
  const state = vm({ child: { n: 0 } });
  const old = state.child;
  const callback = jestApi.fn();
  cleanupWith(vmWatch(state, ['child', 'n'], callback));
  state.child = { n: 1 };
  await flushUpdates();
  old.n = 9;
  await flushUpdates();
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(1, 0, ['child']);
});
test('a shared child notifies both parent paths and stops notifying a replaced path', async () => {
  const child = { n: 0 };
  const state = vm({ a: child, b: child });
  const a = jestApi.fn();
  const b = jestApi.fn();
  cleanupWith(vmWatch(state, ['a', 'n'], a));
  cleanupWith(vmWatch(state, ['b', 'n'], b));
  state.a.n = 1;
  await flushUpdates();
  expect(a).toHaveBeenCalledTimes(1);
  expect(b).toHaveBeenCalledTimes(1);
  state.a = { n: 2 };
  await flushUpdates();
  state.b.n = 3;
  await flushUpdates();
  expect(a).toHaveBeenCalledTimes(2);
  expect(b).toHaveBeenCalledTimes(2);
});
test('raw conversion and ignored values preserve identity', () => {
  const raw = { child: { n: 1 } };
  const state = vm(raw);
  expect(vmRaw(state)).toBe(raw);
  expect(vm(raw)).toBe(state);
  expect(vm(state)).toBe(state);
  const ignored = vmIgnore({ n: 1 });
  const value = vm({ ignored });
  expect(value.ignored).toBe(ignored);
  expect(isViewModel(ignored)).toBe(false);
});
test('getValueByPath handles missing and non-object ancestors', () => {
  expect(getValueByPath({ a: { n: 1 } }, ['a', 'n'])).toBe(1);
  expect(getValueByPath({ a: null }, ['a', 'n'])).toBeUndefined();
  expect(getValueByPath(null, ['n'])).toBeUndefined();
  expect(getValueByPath(1)).toBe(1);
});
test('array callback methods expose reactive objects and searches handle proxy identity', () => {
  const array = vm([{ n: 1 }, { n: 2 }, { n: 3 }]);
  const first = array[0];
  expect(array.find((v) => v.n === 1)).toBe(first);
  expect(array.findLast((v) => v.n < 3)).toBe(array[1]);
  expect(array.findIndex((v) => v.n === 2)).toBe(1);
  expect(array.findLastIndex((v) => v.n < 3)).toBe(1);
  expect(array.some((v) => v.n === 2)).toBe(true);
  expect(array.every((v) => v.n > 0)).toBe(true);
  expect(array.includes(first)).toBe(true);
  expect(array.indexOf(first)).toBe(0);
  expect(array.find((v) => v.n === 9)).toBeUndefined();
});
test('array filter and slice keep item identity and independent structure', () => {
  const array = vm([{ n: 1 }, { n: 2 }]);
  const filtered = array.filter((v) => v.n > 1);
  const sliced = array.slice(1);
  expect(filtered[0]).toBe(array[1]);
  expect(sliced[0]).toBe(array[1]);
  filtered.push({ n: 3 });
  expect(array).toHaveLength(2);
  destroyViewModelCore(filtered as unknown as ViewModel);
  destroyViewModelCore(sliced as unknown as ViewModel);
});
test('removing duplicate child references retains each surviving parent index', () => {
  const child = { n: 1 };
  const array = vm([child, child]);
  const item = array[0] as unknown as ViewModel;
  array.shift();
  expect(item[VM_PARENTS]?.get(array as unknown as ViewModel)).toEqual(new Set([0]));
  array.pop();
  expect(item[VM_PARENTS]?.has(array as unknown as ViewModel)).toBe(false);
});
test('destroying a VM cancels queued notifications', async () => {
  const state = vm({ n: 0 });
  const callback = jestApi.fn();
  vmWatch(state, 'n', callback);
  state.n = 1;
  destroyViewModelCore(state as unknown as ViewModel);
  await flushUpdates();
  expect(callback).not.toHaveBeenCalled();
});

test('deep immediate watch on a plain object emits once and returns a no-op cancellation', () => {
  const value = { n: 1 };
  const callback = jestApi.fn();
  const cancel = vmWatch(value, callback, { immediate: true });
  expect(callback).toHaveBeenCalledWith(value, undefined);
  expect(() => cancel()).not.toThrow();
});
test('built-in DOM and error objects are not wrapped', () => {
  const node = document.createElement('div');
  const error = new Error('native');
  expect(vm(node)).toBe(node);
  expect(vm(error)).toBe(error);
});
test('deep watch aggregates a later shorter mutation path', async () => {
  const state = vm({ child: { nested: { n: 0 } } });
  const callback = jestApi.fn();
  cleanupWith(vmWatch(state, 'child', callback, { deep: true }));
  state.child.nested.n = 1;
  state.child.nested = { n: 2 };
  await flushUpdates();
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback.mock.calls[0][2]).toEqual(['child', 'nested']);
});
test('watching an array itself reports mutations without a concrete property path', async () => {
  const array = vm([1]);
  const callback = jestApi.fn();
  cleanupWith(vmWatch(array, callback));
  array.push(2);
  await flushUpdates();
  expect(callback).toHaveBeenCalledWith(array, array, undefined);
});
test('array search predicates preserve primitive values and missing last matches', () => {
  const array = vm([1, 2, 3]);
  expect(array.findLast((v) => v < 3)).toBe(2);
  expect(array.findLast((v) => v < 0)).toBeUndefined();
  expect(array.findLastIndex((v) => v < 0)).toBe(-1);
});

import { vm, vmRaw, vmWatch } from '../../src';
import { VM_PARENTS, isViewModel } from '../../src/vm/core';
import { cleanupWith, flushUpdates, jestApi, setupRuntimeTests } from '../_helper';

setupRuntimeTests();

test('delete notifies the property, descendant path and parent watchers', async () => {
  const state = vm<{ child?: { n: number } }>({ child: { n: 1 } });
  const old = state.child;
  const property = jestApi.fn();
  const descendant = jestApi.fn();
  const parent = jestApi.fn();
  cleanupWith(vmWatch(state, 'child', property));
  cleanupWith(vmWatch(state, ['child', 'n'], descendant));
  cleanupWith(vmWatch(state, parent));
  expect(delete state.child).toBe(true);
  expect(Object.hasOwn(vmRaw(state), 'child')).toBe(false);
  await flushUpdates();
  expect(property).toHaveBeenCalledWith(undefined, old, ['child']);
  expect(descendant).toHaveBeenCalledWith(undefined, 1, ['child']);
  expect(parent).toHaveBeenCalledTimes(1);
  expect(parent).toHaveBeenCalledWith(state, state, ['child']);
  parent.mockClear();
  old!.n = 2;
  await flushUpdates();
  expect(parent).not.toHaveBeenCalled();
});

test('deleting an undefined property still notifies a deep watcher', async () => {
  const state = vm<{ value?: number }>({ value: undefined });
  const deep = jestApi.fn();
  cleanupWith(vmWatch(state, deep));
  delete state.value;
  await flushUpdates();
  expect(deep).toHaveBeenCalledWith(state, state, ['value']);
});

test('deleting a missing or inherited property does not notify', async () => {
  const state = vm(Object.assign(Object.create({ inherited: 1 }), { own: 2 }));
  const deep = jestApi.fn();
  cleanupWith(vmWatch(state, deep));
  expect(Reflect.deleteProperty(state, 'missing')).toBe(true);
  expect(Reflect.deleteProperty(state, 'inherited')).toBe(true);
  expect(state.inherited).toBe(1);
  await flushUpdates();
  expect(deep).not.toHaveBeenCalled();
});

test('failed deletion preserves the value and its parent link', async () => {
  const raw = { child: { n: 1 } };
  Object.defineProperty(raw, 'child', { configurable: false });
  const state = vm(raw);
  const deep = jestApi.fn();
  cleanupWith(vmWatch(state, deep));
  expect(Reflect.deleteProperty(state, 'child')).toBe(false);
  expect(() => {
    delete (state as { child?: unknown }).child;
  }).toThrow(TypeError);
  await flushUpdates();
  expect(deep).not.toHaveBeenCalled();
  state.child.n = 2;
  await flushUpdates();
  expect(deep).toHaveBeenCalledWith(state, state, ['child', 'n']);
});

test('deleting one shared alias preserves the other alias notification', async () => {
  const child = { n: 1 };
  const state = vm<{ a?: typeof child; b: typeof child }>({ a: child, b: child });
  delete state.a;
  const deep = jestApi.fn();
  cleanupWith(vmWatch(state, deep));
  state.b.n = 2;
  await flushUpdates();
  expect(deep).toHaveBeenCalledWith(state, state, ['b', 'n']);
  if (!isViewModel(state.b) || !isViewModel(state)) throw new Error('Expected ViewModels');
  expect(state.b[VM_PARENTS]?.get(state)).toEqual(new Set(['b']));
});

test('deleting an own property links the revealed inherited child', async () => {
  const inherited = { n: 1 };
  const raw = Object.assign(Object.create({ child: inherited }), { child: { n: 2 } });
  const state = vm(raw);
  const removed = state.child;
  expect(Reflect.deleteProperty(state, 'child')).toBe(true);
  const deep = jestApi.fn();
  cleanupWith(vmWatch(state, deep));
  removed.n = 3;
  await flushUpdates();
  expect(deep).not.toHaveBeenCalled();
  state.child.n = 4;
  await flushUpdates();
  expect(deep).toHaveBeenCalledWith(state, state, ['child', 'n']);
});

test('deleting an accessor does not evaluate its getter', async () => {
  const getter = jestApi.fn(() => 1);
  const raw = {};
  Object.defineProperty(raw, 'value', { get: getter, configurable: true });
  const state = vm(raw);
  const deep = jestApi.fn();
  cleanupWith(vmWatch(state, deep));
  expect(Reflect.deleteProperty(state, 'value')).toBe(true);
  await flushUpdates();
  expect(getter).not.toHaveBeenCalled();
  expect(deep).toHaveBeenCalledWith(state, state, ['value']);
});

test('delete followed by reassign coalesces to the final value and restores the parent link', async () => {
  const state = vm<{ child?: { n: number } }>({ child: { n: 1 } });
  const property = jestApi.fn();
  cleanupWith(vmWatch(state, 'child', property));
  const old = state.child;
  delete state.child;
  state.child = { n: 2 };
  await flushUpdates();
  expect(property).toHaveBeenCalledTimes(1);
  expect(property).toHaveBeenCalledWith(state.child, old, ['child']);
  const deep = jestApi.fn();
  cleanupWith(vmWatch(state, deep));
  state.child.n = 3;
  await flushUpdates();
  expect(deep).toHaveBeenCalledWith(state, state, ['child', 'n']);
});

test('array delete leaves a hole, preserves length and notifies index and ancestors', async () => {
  const state = vm({ list: [{ n: 1 }, { n: 2 }] });
  const removed = state.list[0];
  const index = jestApi.fn();
  const length = jestApi.fn();
  const parent = jestApi.fn();
  cleanupWith(vmWatch(state.list, 0, index));
  cleanupWith(vmWatch(state.list, 'length', length));
  cleanupWith(vmWatch(state, parent));
  expect(Reflect.deleteProperty(state.list, '0')).toBe(true);
  expect(state.list.length).toBe(2);
  expect(0 in state.list).toBe(false);
  expect(Object.keys(state.list)).toEqual(['1']);
  await flushUpdates();
  expect(index).toHaveBeenCalledWith(undefined, removed, [0]);
  expect(length).not.toHaveBeenCalled();
  expect(parent).toHaveBeenCalledWith(state, state, ['list', 0]);
  parent.mockClear();
  removed.n = 3;
  await flushUpdates();
  expect(parent).not.toHaveBeenCalled();
});

test('array hole, length and custom property deletion follow native semantics', async () => {
  const array = vm(Object.assign([1, 2], { note: { n: 1 } }));
  array.note = { n: 2 };
  const old = array.note;
  const deep = jestApi.fn();
  cleanupWith(vmWatch(array, deep));
  expect(Reflect.deleteProperty(array, '9')).toBe(true);
  expect(Reflect.deleteProperty(array, 'length')).toBe(false);
  await flushUpdates();
  expect(deep).not.toHaveBeenCalled();
  expect(Reflect.deleteProperty(array, 'note')).toBe(true);
  await flushUpdates();
  expect(deep).toHaveBeenCalledWith(array, array, ['note']);
  deep.mockClear();
  old.n = 2;
  await flushUpdates();
  expect(deep).not.toHaveBeenCalled();
});

test.each([false, true])('symbol deletion stays non-reactive (array: %s)', async (array) => {
  const key = Symbol('value');
  const raw = array ? Object.assign([], { [key]: 1 }) : { [key]: 1 };
  const state = vm(raw);
  const deep = jestApi.fn();
  cleanupWith(vmWatch(state, deep));
  expect(Reflect.deleteProperty(state, key)).toBe(true);
  expect(Object.hasOwn(raw, key)).toBe(false);
  await flushUpdates();
  expect(deep).not.toHaveBeenCalled();
});

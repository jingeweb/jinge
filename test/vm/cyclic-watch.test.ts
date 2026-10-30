import { vm, vmWatch } from '../../src';
import { cleanupWith, flushUpdates, jestApi, setupRuntimeTests } from '../_helper';

setupRuntimeTests();
interface CyclicNode {
  n: number;
  next?: CyclicNode;
}

test('self-referential data can be wrapped and notifies direct watchers once', async () => {
  const raw: CyclicNode = { n: 0 };
  raw.next = raw;
  const state = vm(raw);
  expect(state.next).toBe(state);
  const scalar = jestApi.fn();
  const deep = jestApi.fn();
  cleanupWith(vmWatch(state, 'n', scalar));
  cleanupWith(vmWatch(state, deep));
  state.n = 1;
  await flushUpdates();
  expect(scalar).toHaveBeenCalledWith(1, 0, ['n']);
  expect(scalar).toHaveBeenCalledTimes(1);
  expect(deep).toHaveBeenCalledTimes(1);
  expect(deep.mock.calls[0][2]).toEqual(['n']);
});
test('a two-node cycle terminates while notifying the other node through an acyclic path', async () => {
  const a: CyclicNode = { n: 0 };
  const b: CyclicNode = { n: 10, next: a };
  a.next = b;
  const state = vm(a);
  const throughB = jestApi.fn();
  cleanupWith(vmWatch(state.next!, ['next', 'n'], throughB));
  state.n = 1;
  await flushUpdates();
  expect(throughB).toHaveBeenCalledTimes(1);
  expect(throughB).toHaveBeenCalledWith(1, 0, ['next', 'n']);
});
test('cycle prevention does not suppress separate parent aliases of a shared object', async () => {
  const node: CyclicNode = { n: 0 };
  node.next = node;
  const root = vm({ a: node, b: node });
  const a = jestApi.fn();
  const b = jestApi.fn();
  const deep = jestApi.fn();
  cleanupWith(vmWatch(root, ['a', 'n'], a));
  cleanupWith(vmWatch(root, ['b', 'n'], b));
  cleanupWith(vmWatch(root, deep));
  root.a.n = 1;
  await flushUpdates();
  expect(a).toHaveBeenCalledWith(1, 0, ['a', 'n']);
  expect(b).toHaveBeenCalledWith(1, 0, ['b', 'n']);
  expect(deep).toHaveBeenCalledTimes(1);
});
test('cycles can be introduced after wrapping without rejecting writes or overflowing notifications', async () => {
  const state = vm<CyclicNode>({ n: 0 });
  const callback = jestApi.fn();
  cleanupWith(vmWatch(state, callback));
  expect(() => {
    state.next = state;
  }).not.toThrow();
  await flushUpdates();
  expect(state.next).toBe(state);
  expect(callback).toHaveBeenCalledTimes(1);
  state.n = 1;
  state.n = 2;
  await flushUpdates();
  expect(callback).toHaveBeenCalledTimes(2);
});
test('a self-referential array can be mutated and cancelled safely', async () => {
  const array = vm<unknown[]>([]);
  const callback = jestApi.fn();
  const cancel = cleanupWith(vmWatch(array, callback));
  array.push(array);
  await flushUpdates();
  expect(array[0]).toBe(array);
  expect(callback).toHaveBeenCalledTimes(1);
  cancel();
  array.push(1);
  await flushUpdates();
  expect(callback).toHaveBeenCalledTimes(1);
});
test('notifications deliberately stop before revisiting a node on a cyclic path', async () => {
  const raw: CyclicNode = { n: 0 };
  raw.next = raw;
  const state = vm(raw);
  const cyclicPath = jestApi.fn();
  const direct = jestApi.fn();
  cleanupWith(vmWatch(state, ['next', 'n'], cyclicPath));
  cleanupWith(vmWatch(state.next!, 'n', direct));
  state.n = 1;
  await flushUpdates();
  // Cyclic alias paths are not expanded. Subscribe to the object itself instead.
  expect(cyclicPath).not.toHaveBeenCalled();
  expect(direct).toHaveBeenCalledWith(1, 0, ['n']);
});

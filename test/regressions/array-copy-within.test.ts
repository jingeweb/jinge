import { vm, vmWatch } from '../../src';
import { cleanupWith, flushUpdates, jestApi, setupRuntimeTests } from '../_helper';

setupRuntimeTests();

test('copyWithin should notify array and parent watchers when it changes array values', async () => {
  const state = vm({ items: [1, 2, 3] });
  const direct = jestApi.fn();
  const parent = jestApi.fn();
  const index = jestApi.fn();
  cleanupWith(vmWatch(state.items, direct));
  cleanupWith(vmWatch(state, 'items', parent, { deep: true }));
  cleanupWith(vmWatch(state.items, 0, index));
  state.items.copyWithin(0, 1, 2);
  await flushUpdates();
  expect([...state.items]).toEqual([2, 2, 3]);
  expect(direct).toHaveBeenCalledTimes(1);
  expect(parent).toHaveBeenCalledTimes(1);
  expect(index).toHaveBeenCalledWith(2, 1, undefined);
});

test('copyWithin should detach overwritten children and link copied children to destination indexes', async () => {
  const state = vm({ items: [{ n: 1 }, { n: 2 }] });
  const overwritten = state.items[0];
  state.items.copyWithin(0, 1, 2);
  await flushUpdates();
  const direct = jestApi.fn();
  const parent = jestApi.fn();
  const destination = jestApi.fn();
  cleanupWith(vmWatch(state.items, direct));
  cleanupWith(vmWatch(state, 'items', parent, { deep: true }));
  cleanupWith(vmWatch(state.items, [0, 'n'], destination));
  state.items[0].n = 3;
  await flushUpdates();
  expect(destination).toHaveBeenCalledTimes(1);
  expect(destination.mock.calls[0].slice(0, 2)).toEqual([3, 2]);
  direct.mockClear();
  parent.mockClear();
  destination.mockClear();
  overwritten.n = 99;
  await flushUpdates();
  expect(direct).not.toHaveBeenCalled();
  expect(parent).not.toHaveBeenCalled();
  expect(destination).not.toHaveBeenCalled();
});

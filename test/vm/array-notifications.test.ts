import { vm, vmWatch } from '../../src';
import { cleanupWith, flushUpdates, jestApi, setupRuntimeTests } from '../_helper';

setupRuntimeTests();

interface NumberWrite {
  name: string;
  initial: number[];
  write: (array: number[]) => unknown;
  expected: (number | undefined)[];
}

const writes: NumberWrite[] = [
  { name: 'push', initial: [1, 2], write: (a) => a.push(3, 4), expected: [1, 2, 3, 4] },
  { name: 'pop', initial: [1, 2], write: (a) => a.pop(), expected: [1] },
  { name: 'unshift', initial: [1, 2], write: (a) => a.unshift(3, 4), expected: [3, 4, 1, 2] },
  { name: 'shift', initial: [1, 2], write: (a) => a.shift(), expected: [2] },
  { name: 'splice insert', initial: [1, 2], write: (a) => a.splice(1, 0, 3), expected: [1, 3, 2] },
  { name: 'splice delete', initial: [1, 2, 3], write: (a) => a.splice(1, 1), expected: [1, 3] },
  { name: 'splice replace', initial: [1, 2], write: (a) => a.splice(0, 1, 3), expected: [3, 2] },
  { name: 'splice negative start', initial: [1, 2], write: (a) => a.splice(-1, 1), expected: [1] },
  {
    name: 'splice omitted deleteCount',
    initial: [1, 2, 3],
    write: (a) => a.splice(1),
    expected: [1],
  },
  {
    name: 'splice into empty array',
    initial: [],
    write: (a) => a.splice(0, 0, 1, 2),
    expected: [1, 2],
  },
  { name: 'fill', initial: [1, 2, 3], write: (a) => a.fill(9, 1), expected: [1, 9, 9] },
  {
    name: 'fill normalized range',
    initial: [1, 2, 3],
    write: (a) => a.fill(9, -1, 99),
    expected: [1, 2, 9],
  },
  {
    name: 'copyWithin',
    initial: [1, 2, 3],
    write: (a) => a.copyWithin(0, 1, 2),
    expected: [2, 2, 3],
  },
  { name: 'reverse', initial: [1, 2, 3], write: (a) => a.reverse(), expected: [3, 2, 1] },
  { name: 'sort', initial: [3, 1, 2], write: (a) => a.sort((a, b) => a - b), expected: [1, 2, 3] },
  {
    name: 'index replacement',
    initial: [1, 2],
    write: (a) => {
      a[0] = 3;
    },
    expected: [3, 2],
  },
  {
    name: 'index append',
    initial: [1, 2],
    write: (a) => {
      a[2] = 3;
    },
    expected: [1, 2, 3],
  },
  {
    name: 'length shrink',
    initial: [1, 2, 3],
    write: (a) => {
      a.length = 1;
    },
    expected: [1],
  },
  {
    name: 'length grow',
    initial: [1, 2],
    write: (a) => {
      a.length = 4;
    },
    expected: [1, 2, undefined, undefined],
  },
  {
    name: 'length clear',
    initial: [1, 2],
    write: (a) => {
      a.length = 0;
    },
    expected: [],
  },
];

test.each(writes)(
  '$name notifies array, parent, changed index and length watchers',
  async ({ initial, write, expected }) => {
    const state = vm({ items: [...initial] });
    const array = state.items;
    const direct = jestApi.fn();
    const parent = jestApi.fn();
    const shallowParent = jestApi.fn();
    const length = jestApi.fn();
    const index = jestApi.fn();
    const indexCount = Math.max(initial.length, expected.length);
    const changedIndex =
      Array.from({ length: indexCount }, (_, i) => i).find(
        (i) => !Object.is(initial[i], expected[i]),
      ) ?? 0;
    cleanupWith(vmWatch(array, direct));
    cleanupWith(vmWatch(state, 'items', parent, { deep: true }));
    cleanupWith(vmWatch(state, 'items', shallowParent));
    cleanupWith(vmWatch(array, 'length', length));
    cleanupWith(vmWatch(array, changedIndex, index));

    write(array);
    expect(direct).not.toHaveBeenCalled();
    await flushUpdates();

    expect([...array]).toStrictEqual(expected);
    expect(direct).toHaveBeenCalledTimes(1);
    expect(direct.mock.calls[0][0]).toBe(array);
    expect(direct.mock.calls[0][1]).toBe(array);
    expect(parent).toHaveBeenCalledTimes(1);
    expect(parent.mock.calls[0][0]).toBe(array);
    // In-place writes do not replace the parent's items reference.
    expect(shallowParent).not.toHaveBeenCalled();
    if (initial.length !== expected.length) {
      expect(length).toHaveBeenCalledTimes(1);
      expect(length.mock.calls[0].slice(0, 2)).toEqual([expected.length, initial.length]);
    } else {
      expect(length).not.toHaveBeenCalled();
    }
    if (!Object.is(initial[changedIndex], expected[changedIndex])) {
      expect(index).toHaveBeenCalledTimes(1);
      expect(index.mock.calls[0].slice(0, 2)).toEqual([
        expected[changedIndex],
        initial[changedIndex],
      ]);
    } else {
      expect(index).not.toHaveBeenCalled();
    }
  },
);

const noOps: Pick<NumberWrite, 'name' | 'initial' | 'write'>[] = [
  { name: 'push without arguments', initial: [1], write: (a) => a.push() },
  { name: 'unshift without arguments', initial: [1], write: (a) => a.unshift() },
  { name: 'pop empty array', initial: [], write: (a) => a.pop() },
  { name: 'shift empty array', initial: [], write: (a) => a.shift() },
  { name: 'splice without arguments', initial: [1], write: (a) => Reflect.apply(a.splice, a, []) },
  { name: 'splice zero deletion', initial: [1], write: (a) => a.splice(0, 0) },
  {
    name: 'splice explicit undefined deletion',
    initial: [1],
    write: (a) => a.splice(0, undefined),
  },
  { name: 'splice empty array', initial: [], write: (a) => a.splice(0, 1) },
  { name: 'fill empty array', initial: [], write: (a) => a.fill(9) },
  { name: 'fill empty range', initial: [1, 2], write: (a) => a.fill(9, 1, 1) },
  { name: 'fill range beyond length', initial: [1], write: (a) => a.fill(9, 9) },
  { name: 'copyWithin empty array', initial: [], write: (a) => a.copyWithin(0, 1) },
  { name: 'copyWithin empty range', initial: [1, 2], write: (a) => a.copyWithin(0, 1, 1) },
  {
    name: 'copyWithin identical source and destination',
    initial: [1, 2],
    write: (a) => a.copyWithin(1, 1),
  },
  {
    name: 'copyWithin destination beyond length',
    initial: [1, 2],
    write: (a) => a.copyWithin(99, 0),
  },
  { name: 'reverse empty array', initial: [], write: (a) => a.reverse() },
  { name: 'reverse single element', initial: [1], write: (a) => a.reverse() },
  { name: 'sort empty array', initial: [], write: (a) => a.sort((a, b) => a - b) },
  { name: 'sort single element', initial: [1], write: (a) => a.sort((a, b) => a - b) },
  {
    name: 'same length assignment',
    initial: [1],
    write: (a) => {
      a.length = 1;
    },
  },
  {
    name: 'same index value assignment',
    initial: [1],
    write: (a) => {
      a[0] = 1;
    },
  },
];

test.each(noOps)('$name does not emit a change notification', async ({ initial, write }) => {
  const state = vm({ items: [...initial] });
  const direct = jestApi.fn();
  const parent = jestApi.fn();
  const length = jestApi.fn();
  cleanupWith(vmWatch(state.items, direct));
  cleanupWith(vmWatch(state, 'items', parent, { deep: true }));
  cleanupWith(vmWatch(state.items, 'length', length));
  write(state.items);
  await flushUpdates();
  expect([...state.items]).toEqual(initial);
  expect(direct).not.toHaveBeenCalled();
  expect(parent).not.toHaveBeenCalled();
  expect(length).not.toHaveBeenCalled();
});

interface Item {
  n: number;
}
const objectWrites: { name: string; write: (array: Item[]) => unknown }[] = [
  { name: 'push', write: (a) => a.push({ n: 3 }) },
  { name: 'pop', write: (a) => a.pop() },
  { name: 'unshift', write: (a) => a.unshift({ n: 3 }) },
  { name: 'shift', write: (a) => a.shift() },
  { name: 'splice', write: (a) => a.splice(0, 1, { n: 3 }) },
  { name: 'fill', write: (a) => a.fill({ n: 3 }) },
  { name: 'copyWithin', write: (a) => a.copyWithin(0, 1, 2) },
  { name: 'reverse', write: (a) => a.reverse() },
  { name: 'sort', write: (a) => a.sort((a, b) => a.n - b.n) },
  {
    name: 'index replacement',
    write: (a) => {
      a[0] = { n: 3 };
    },
  },
  {
    name: 'index append',
    write: (a) => {
      a[2] = { n: 3 };
    },
  },
  {
    name: 'length shrink',
    write: (a) => {
      a.length = 1;
    },
  },
];

test.each(objectWrites)(
  '$name preserves nested notifications and detaches removed items',
  async ({ write }) => {
    const state = vm({ items: [{ n: 2 }, { n: 1 }] });
    const before = [...state.items];
    const direct = jestApi.fn();
    const parent = jestApi.fn();
    cleanupWith(vmWatch(state.items, direct));
    cleanupWith(vmWatch(state, 'items', parent, { deep: true }));
    write(state.items);
    await flushUpdates();
    expect(direct).toHaveBeenCalledTimes(1);
    expect(parent).toHaveBeenCalledTimes(1);
    direct.mockClear();
    parent.mockClear();

    state.items[0].n += 10;
    await flushUpdates();
    expect(direct).toHaveBeenCalledTimes(1);
    // fill may put the same child at multiple indexes; either changed alias
    // is a valid path for the coalesced deep-array notification.
    const [notifiedIndex, property] = direct.mock.calls[0][2] as [number, string];
    expect(property).toBe('n');
    expect(state.items[notifiedIndex]).toBe(state.items[0]);
    expect(parent).toHaveBeenCalledTimes(1);
    const [parentProperty, parentIndex, childProperty] = parent.mock.calls[0][2] as [
      string,
      number,
      string,
    ];
    expect(parentProperty).toBe('items');
    expect(childProperty).toBe('n');
    expect(state.items[parentIndex]).toBe(state.items[0]);
    direct.mockClear();
    parent.mockClear();

    for (const removed of before.filter((item) => !state.items.includes(item))) removed.n += 100;
    await flushUpdates();
    expect(direct).not.toHaveBeenCalled();
    expect(parent).not.toHaveBeenCalled();
  },
);

test('mixed writes in one tick coalesce and expose the final array, index and length values', async () => {
  const state = vm({ items: [1, 2] });
  const direct = jestApi.fn();
  const parent = jestApi.fn();
  const index = jestApi.fn();
  const length = jestApi.fn();
  cleanupWith(vmWatch(state.items, direct));
  cleanupWith(vmWatch(state, 'items', parent, { deep: true }));
  cleanupWith(vmWatch(state.items, 1, index));
  cleanupWith(vmWatch(state.items, 'length', length));
  state.items.push(3);
  state.items.reverse();
  state.items.splice(1, 1, 9);
  await flushUpdates();
  expect([...state.items]).toEqual([3, 9, 1]);
  expect(direct).toHaveBeenCalledTimes(1);
  expect(parent).toHaveBeenCalledTimes(1);
  expect(index).toHaveBeenCalledTimes(1);
  expect(index.mock.calls[0].slice(0, 2)).toEqual([9, 2]);
  expect(length).toHaveBeenCalledTimes(1);
  expect(length.mock.calls[0].slice(0, 2)).toEqual([3, 2]);
});

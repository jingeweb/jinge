import { vm, vmWatch } from '../../src';
import { setupRegressionTests, flushUpdates } from './_helper';

setupRegressionTests();

test('array index extension should notify length', async () => {
  const arr = vm([1]);
  const values: number[] = [];
  vmWatch(arr, 'length', (v) => values.push(v));
  arr[1] = 2;
  await flushUpdates();
  expect(values).toEqual([2]);
});

test('splice(-1,1) should return the actual removed element', () => {
  const arr = vm([1, 2, 3]);
  expect(arr.splice(-1, 1)).toEqual([3]);
});

test('splice(start) should remove the remaining items', () => {
  const arr = vm([1, 2, 3]);
  expect(arr.splice(1)).toEqual([2, 3]);
  expect(arr).toEqual([1]);
});

test('fill should normalize negative start and clamp end', () => {
  const arr = vm([1, 2, 3]);
  arr.fill(9, -1, 5);
  expect([...arr]).toEqual([1, 2, 9]);
});

test('delete should notify an existing property watcher', async () => {
  const state = vm<{ name?: string }>({ name: 'a' });
  const values: any[] = [];
  vmWatch(state, 'name', (v) => values.push(v));
  delete state.name;
  await flushUpdates();
  expect(values).toStrictEqual([undefined]);
});

test('cyclic vm should allow updating a scalar property', () => {
  const raw: any = { n: 0 };
  raw.self = raw;
  const state = vm(raw);
  expect(() => {
    state.n = 1;
  }).not.toThrow();
});

// 现代浏览器都有 OffscreenCanvas，不假设它不存在。
// test('vm should work when OffscreenCanvas is unavailable', () => {
//   const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'OffscreenCanvas');
//   Reflect.deleteProperty(globalThis, 'OffscreenCanvas');
//   try {
//     expect(() => vm({ n: 0 })).not.toThrow();
//   } finally {
//     if (descriptor) Object.defineProperty(globalThis, 'OffscreenCanvas', descriptor);
//   }
// });

test('for-of should yield the same reactive objects as indexed access', async () => {
  const arr = vm([{ name: 'a' }]);
  const values: any[] = [];
  vmWatch(arr, [0, 'name'], (v) => values.push(v));
  for (const item of arr) item.name = 'b';
  await flushUpdates();
  expect(values).toEqual(['b']);
});

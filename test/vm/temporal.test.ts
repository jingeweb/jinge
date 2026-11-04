import { runInNewContext } from 'node:vm';

import { isViewModel, vm, vmWatch } from '../../src';
import { cleanupWith, flushUpdates, jestApi, setupRuntimeTests } from '../_helper';
setupRuntimeTests();
// Jest's jsdom realm does not yet expose Temporal. Use the actual Node 26 engine built-in.
const temporal = runInNewContext('Temporal') as Record<
  string,
  { from(input: unknown): { toString(): string } }
>;
const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Temporal');
beforeAll(() =>
  Object.defineProperty(globalThis, 'Temporal', { configurable: true, value: temporal }),
);
afterAll(() => {
  if (descriptor) Object.defineProperty(globalThis, 'Temporal', descriptor);
  else Reflect.deleteProperty(globalThis, 'Temporal');
});
const cases = [
  ['PlainDate', '2026-11-03'],
  ['PlainTime', '12:34:56'],
  ['PlainDateTime', '2026-11-03T12:34:56'],
  ['PlainYearMonth', '2026-11'],
  ['PlainMonthDay', '11-03'],
  ['Instant', '2026-11-03T00:00:00Z'],
  ['ZonedDateTime', '2026-11-03T08:00:00+08:00[Asia/Shanghai]'],
  ['Duration', 'P1DT2H'],
];
test.each(cases)(
  '%s stays an opaque immutable value at root, object and array positions',
  (name, input) => {
    const value = temporal[name].from(input);
    expect(vm(value)).toBe(value);
    const state = vm({ value, list: [value] });
    expect(state.value).toBe(value);
    expect(state.list[0]).toBe(value);
    expect(isViewModel(state.value)).toBe(false);
    expect(state.value.toString()).toBe(value.toString());
  },
);
test('replacing a Temporal value notifies normal path watchers without traversing native internals', async () => {
  const first = temporal.PlainDate.from('2026-11-03'),
    next = temporal.PlainDate.from('2026-11-04');
  const state = vm({ value: first }),
    callback = jestApi.fn();
  cleanupWith(vmWatch(state, 'value', callback));
  state.value = next;
  await flushUpdates();
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback.mock.calls[0][0]).toBe(next);
  expect(callback.mock.calls[0][1]).toBe(first);
});
test('Temporal-like user objects remain reactive and the runtime also works without Temporal', () => {
  const fake = vm({ [Symbol.toStringTag]: 'Temporal.PlainDate', year: 2026 });
  expect(isViewModel(fake)).toBe(true);
  Reflect.deleteProperty(globalThis, 'Temporal');
  try {
    expect(isViewModel(vm({ value: 1 }))).toBe(true);
    const date = new Date();
    expect(vm(date)).toBe(date);
  } finally {
    Object.defineProperty(globalThis, 'Temporal', { configurable: true, value: temporal });
  }
});

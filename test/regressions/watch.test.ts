import {
  DymPathWatcher,
  PathWatcher,
  VM_WATCHERS,
  destroyComponent,
  vm,
  watchForRender,
} from '../../src';
import { setupRegressionTests, flushUpdates, createHost } from './_helper';

setupRegressionTests();

test('DymPathWatcher should release index watchers on component destruction', async () => {
  const state = vm({ index: 0, items: ['a', 'b'] });
  const host = createHost();
  watchForRender(
    DymPathWatcher(state as any, ['items', PathWatcher(state as any, ['index'])]),
    () => {},
    host,
  );
  expect((state as any)[VM_WATCHERS].size).toBe(2);
  destroyComponent(host);
  expect((state as any)[VM_WATCHERS].size).toBe(0);
});

test('dynamic indexing should update even when the target array is not reactive', async () => {
  const index = vm({ value: 0 });
  const host = createHost();
  const values: any[] = [];
  watchForRender(
    DymPathWatcher(['a', 'b'] as any, [PathWatcher(index as any, ['value'])]),
    (v) => values.push(v),
    host,
  );
  index.value = 1;
  await flushUpdates();
  expect(values).toEqual(['a', 'b']);
});

test('destroyed dynamic path watcher must not re-register after index changes', async () => {
  const state = vm({ index: 0, items: ['a', 'b'] });
  const host = createHost();
  watchForRender(
    DymPathWatcher(state as any, ['items', PathWatcher(state as any, ['index'])]),
    () => {},
    host,
  );
  destroyComponent(host);
  state.index = 1;
  await flushUpdates();
  expect((state as any)[VM_WATCHERS].size).toBe(0);
});

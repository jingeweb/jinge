import { vm } from '../../src';
import { nextTick } from '../../src/util/tick';
import { vmWatch } from '../../src/vm';
import { setupRuntimeTests } from '../_helper';

setupRuntimeTests();

test('nextTick resolves after pending view-model updates', async () => {
  const state = vm({ n: 0 });
  const seen: number[] = [];
  const unwatch = vmWatch(state, 'n', (value) => seen.push(value));

  state.n = 1;
  expect(seen).toEqual([]);

  await nextTick();
  expect(seen).toEqual([1]);

  unwatch();
});

test('nextTick runs after already scheduled immediates', async () => {
  const order: string[] = [];
  setImmediate(() => order.push('immediate'));
  const pending = nextTick().then(() => order.push('tick'));

  expect(order).toEqual([]);
  await pending;
  expect(order).toEqual(['immediate', 'tick']);
});

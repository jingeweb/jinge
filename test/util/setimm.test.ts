import { clearImmediate, setImmediate } from '../../src/util/setimm';
import { flushUpdates, jestApi, setupRuntimeTests } from '../_helper';
setupRuntimeTests();
test('scheduler runs asynchronously in registration order', async () => {
  const order: number[] = [];
  setImmediate(() => order.push(1));
  setImmediate(() => order.push(2));
  expect(order).toEqual([]);
  await flushUpdates();
  expect(order).toEqual([1, 2]);
});
test('cancelled callbacks do not run and cancelling twice is harmless', async () => {
  const callback = jestApi.fn();
  const handle = setImmediate(callback);
  clearImmediate(handle);
  clearImmediate(handle);
  await flushUpdates();
  expect(callback).not.toHaveBeenCalled();
});
test('a throwing callback is reported without blocking later callbacks', async () => {
  const error = new Error('scheduled failure');
  const report = jestApi.spyOn(console, 'error').mockImplementation(() => {});
  const next = jestApi.fn();
  setImmediate(() => {
    throw error;
  });
  setImmediate(next);
  await flushUpdates();
  expect(report).toHaveBeenCalledWith(error);
  expect(next).toHaveBeenCalledTimes(1);
});

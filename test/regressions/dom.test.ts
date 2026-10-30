import { registerEvent } from '../../src';
import { setupRegressionTests } from './_helper';

const jestApi = (import.meta as ImportMeta & { jest: typeof jest }).jest;

setupRegressionTests();

test('registerEvent should unregister a capture listener', () => {
  const node = document.createElement('button');
  const handler = jestApi.fn();
  const cancel = registerEvent(node, 'click', handler, true);
  cancel();
  node.click();
  expect(handler).not.toHaveBeenCalled();
});

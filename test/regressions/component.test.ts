import {
  type ComponentHost,
  Transition,
  DEFAULT_SLOT_NAME,
  ROOT_NODES,
  VM_WATCHERS,
  destroyComponent,
  renderFunctionComponent,
  handleRenderDone,
  getCurrentComponentHost,
  vm,
} from '../../src';
import { setupRegressionTests, createHost } from './_helper';

setupRegressionTests();

test('Transition should release its isEnter watcher on destruction', () => {
  const props = vm({
    isEnter: true,
    [DEFAULT_SLOT_NAME]: (_: any, h: ComponentHost) => {
      const node = document.createElement('div');
      h[ROOT_NODES].push(node);
      return [node];
    },
  });
  const host = createHost();
  document.body.append(...renderFunctionComponent(host, Transition as any, props));
  handleRenderDone(host);
  destroyComponent(host);
  expect((props as any)[VM_WATCHERS].size).toBe(0);
});

test('render exception should restore the current component host', () => {
  const host = createHost();
  expect(() =>
    renderFunctionComponent(host, () => {
      throw new Error('render failed');
    }),
  ).toThrow('render failed');
  expect(() => getCurrentComponentHost()).toThrow();
});

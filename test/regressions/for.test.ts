import {
  type ComponentHost,
  For,
  DEFAULT_SLOT_NAME,
  ROOT_NODES,
  renderFunctionComponent,
  handleRenderDone,
  vm,
  watchPathForRender,
} from '../../src';
import { setupRegressionTests, flushUpdates, createHost } from './_helper';

setupRegressionTests();

function mountFor(items: any[], key?: any) {
  const host = createHost();
  const props = vm({
    loop: items,
    key,
    [DEFAULT_SLOT_NAME]: (each: any, h: ComponentHost) => {
      const node = document.createElement('span');
      h[ROOT_NODES].push(node);
      watchPathForRender(each, ['data', 'name'], (v) => (node.dataset.name = String(v)), h);
      watchPathForRender(each, ['index'], (v) => (node.dataset.index = String(v)), h);
      return [node];
    },
  });
  document.body.append(...renderFunctionComponent(host, For as any, props));
  handleRenderDone(host);
  return { host, props };
}

test('For should update when an array element is replaced', async () => {
  const { props } = mountFor(vm([{ id: 1, name: 'a' }]), 'id');
  props.loop[0] = { id: 2, name: 'b' };
  await flushUpdates();
  expect(document.querySelector('span')?.dataset.name).toBe('b');
});

test('unkeyed For should append with the full-array index', async () => {
  const { props } = mountFor(vm([{ name: 'a' }, { name: 'b' }]));
  props.loop.push({ name: 'c' });
  await flushUpdates();
  expect([...document.querySelectorAll('span')].map((n) => n.dataset.index)).toEqual([
    '0',
    '1',
    '2',
  ]);
});

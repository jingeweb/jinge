import {
  type ComponentHost,
  type ViewModel,
  DEFAULT_SLOT_NAME,
  ROOT_NODES,
  VM_PARENTS,
  For,
  KEY_INDEX,
  destroyComponent,
  isViewModel,
  vm,
  watchPathForRender,
} from '../../src';
import { flushUpdates, mount, setupRuntimeTests } from '../_helper';

setupRuntimeTests();
function itemSlot(each: { data: number }, host: ComponentHost) {
  const node = document.createElement('div');
  host[ROOT_NODES].push(node);
  watchPathForRender(
    each as unknown as ViewModel,
    ['data'],
    (value) => (node.textContent = String(value)),
    host,
  );
  return [node];
}
test('For observes a directly supplied VM array inside ordinary compiler props', async () => {
  const arr = vm([10, 20]);
  const props = { loop: arr, key: KEY_INDEX, [DEFAULT_SLOT_NAME]: itemSlot };
  expect(isViewModel(props)).toBe(false);
  mount(For, props);
  arr[0] = 100;
  arr.push(30);
  await flushUpdates();
  expect([...document.body.children].map((n) => n.textContent)).toEqual(['100', '20', '30']);
});
test('direct VM array binding coalesces structural and later nested mutations', async () => {
  const arr = vm([{ n: 1 }]);
  mount(For, {
    loop: arr,
    key: KEY_INDEX,
    [DEFAULT_SLOT_NAME]: (each: { data: { n: number } }, host: ComponentHost) => {
      const node = document.createElement('div');
      host[ROOT_NODES].push(node);
      watchPathForRender(
        each as unknown as ViewModel,
        ['data', 'n'],
        (value) => (node.textContent = String(value)),
        host,
      );
      return [node];
    },
  });
  arr.push({ n: 2 });
  arr[0].n = 10;
  await flushUpdates();
  expect([...document.body.children].map((n) => n.textContent)).toEqual(['10', '2']);
});
test('unmount detaches the internal direct-array observation without destroying the shared array', async () => {
  const arr = vm([10]);
  const parents = () => (arr as unknown as ViewModel)[VM_PARENTS]?.size ?? 0;
  const initial = parents();
  const a = mount(For, { loop: arr, key: KEY_INDEX, [DEFAULT_SLOT_NAME]: itemSlot });
  const b = mount(For, { loop: arr, key: KEY_INDEX, [DEFAULT_SLOT_NAME]: itemSlot });
  expect(parents()).toBe(initial + 2);
  destroyComponent(a);
  expect(parents()).toBe(initial + 1);
  arr.push(20);
  await flushUpdates();
  expect([...document.body.children].map((n) => n.textContent)).toEqual(['10', '20']);
  destroyComponent(b);
  expect(parents()).toBe(initial);
});

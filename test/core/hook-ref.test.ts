import {
  type ComponentHost,
  type WithExpose,
  CONTEXT,
  ROOT_NODES,
  VM_WATCHERS,
  context,
  destroyComponent,
  expose,
  firstDOM,
  getCurrentComponentHost,
  isRef,
  lastDOM,
  onMount,
  onUnmount,
  ref,
  setRefForComponent,
  textRenderFn,
  vm,
  watch,
} from '../../src';
import { createHost, flushUpdates, jestApi, mount, setupRuntimeTests } from '../_helper';
setupRuntimeTests();
test('hooks resolve the current host and expose imperative APIs', () => {
  let actual: ComponentHost | undefined;
  let read: unknown;
  const key = Symbol('theme');
  function App(_: WithExpose<{ answer(): number }>, host: ComponentHost) {
    actual = getCurrentComponentHost();
    context(key, 'dark');
    read = context(key);
    expose<typeof App>({ answer: () => 42 });
    return [textRenderFn(host, 'app')];
  }
  const host = mount(App) as ComponentHost & { answer(): number };
  expect(actual).toBe(host);
  expect(read).toBe('dark');
  expect(host[CONTEXT]?.[key]).toBe('dark');
  expect(host.answer()).toBe(42);
});
test('onMount and onUnmount register and clean up side effects', () => {
  const events: string[] = [];
  const host = mount((_, h) => {
    onMount(() => {
      events.push('mount');
      return () => events.push('mount cleanup');
    });
    onUnmount(() => events.push('unmount'));
    return [textRenderFn(h, 'x')];
  });
  expect(events).toEqual(['mount']);
  destroyComponent(host);
  expect(events).toEqual(['mount', 'unmount', 'mount cleanup']);
});
test('component watch supports property, path and deep subscriptions and stops on unmount', async () => {
  const state = vm({ n: 0, child: { name: 'a' } });
  const scalar = jestApi.fn();
  const path = jestApi.fn();
  const deep = jestApi.fn();
  const host = mount((_, h) => {
    watch(state, 'n', scalar);
    watch(state, ['child', 'name'], path);
    watch(state, deep);
    return [textRenderFn(h, 'x')];
  });
  state.n = 1;
  state.child.name = 'b';
  await flushUpdates();
  expect(scalar).toHaveBeenCalledTimes(1);
  expect(path).toHaveBeenCalledTimes(1);
  expect(deep).toHaveBeenCalledTimes(1);
  destroyComponent(host);
  state.n = 2;
  await flushUpdates();
  expect(scalar).toHaveBeenCalledTimes(1);
  expect((state as any)[VM_WATCHERS].size).toBe(0);
});
test('object and callback refs are cleared when their owner unmounts', () => {
  const host = createHost();
  const node = document.createElement('input');
  host[ROOT_NODES].push(node);
  document.body.append(node);
  const target = ref<HTMLInputElement>();
  const callback = jestApi.fn();
  expect(isRef(target)).toBe(true);
  expect(isRef({})).toBe(false);
  setRefForComponent(host, target, node);
  setRefForComponent(host, callback, node);
  expect(target.value).toBe(node);
  destroyComponent(host);
  expect(target.value).toBeUndefined();
  expect(callback.mock.calls.map((args) => args[0])).toEqual([node, undefined]);
});
test('firstDOM and lastDOM resolve nodes already created by a component', () => {
  let first: unknown;
  let last: unknown;
  const host = mount((_, h) => {
    const nodes = [textRenderFn(h, 'a'), textRenderFn(h, 'b')];
    first = firstDOM();
    last = lastDOM();
    return nodes;
  });
  expect(first).toBe(host[ROOT_NODES][0]);
  expect(last).toBe(host[ROOT_NODES][1]);
});

test.each([
  ['current host', () => getCurrentComponentHost()],
  ['watch', () => watch(vm({ n: 1 }), 'n', () => {})],
  ['onMount', () => onMount(() => {})],
  ['onUnmount', () => onUnmount(() => {})],
  ['context', () => context('missing')],
  ['expose', () => expose({})],
  ['firstDOM', () => firstDOM()],
  ['lastDOM', () => lastDOM()],
])('%s rejects calls outside component rendering', (_, invoke) => {
  expect(invoke).toThrow('global component not found');
});

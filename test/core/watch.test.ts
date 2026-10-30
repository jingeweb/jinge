import {
  type ViewModel,
  VM_WATCHERS,
  DymPathWatcher,
  ExprWatcher,
  PathWatcher,
  destroyComponent,
  vm,
  watchForDOMEventBind,
  watchForRender,
  watchPathForDOMEventBind,
  watchPathForRender,
  watchPathForRender2,
} from '../../src';
import { createHost, flushUpdates, jestApi, setupRuntimeTests } from '../_helper';
setupRuntimeTests();
test('path binding renders immediately and follows replacement of intermediate objects', async () => {
  const state = vm({ child: { name: 'a' } });
  const host = createHost();
  const render = jestApi.fn();
  watchPathForRender(state as unknown as ViewModel, ['child', 'name'], render, host);
  expect(render).toHaveBeenLastCalledWith('a');
  state.child = { name: 'b' };
  await flushUpdates();
  expect(render).toHaveBeenLastCalledWith('b', 'a', ['child']);
  destroyComponent(host, false);
  state.child.name = 'c';
  await flushUpdates();
  expect(render).toHaveBeenCalledTimes(2);
});
test.each([
  [1, false],
  [2, true],
])('path binding applies %i boolean negations', (op, expected) => {
  const render = jestApi.fn();
  watchPathForRender2(
    vm({ enabled: 1 }) as unknown as ViewModel,
    ['enabled'],
    render,
    op,
    createHost(),
  );
  expect(render).toHaveBeenCalledWith(expected);
});
test('plain object path binding renders once without installing VM watchers', () => {
  const value = { n: 5 };
  const render = jestApi.fn();
  watchPathForRender(value as unknown as unknown as ViewModel, ['n'], render, createHost());
  expect(render).toHaveBeenCalledWith(5);
  expect((value as any)[VM_WATCHERS]).toBeUndefined();
});
test('expression watchers batch dependency changes and suppress unchanged results', async () => {
  const state = vm({ a: 1, b: 2 });
  const render = jestApi.fn();
  const host = createHost();
  watchForRender(
    ExprWatcher(
      [
        PathWatcher(state as unknown as ViewModel, ['a']),
        PathWatcher(state as unknown as ViewModel, ['b']),
      ],
      (a, b) => Number(a) + Number(b),
    ),
    render,
    host,
  );
  expect(render).toHaveBeenLastCalledWith(3);
  state.a = 2;
  state.b = 3;
  await flushUpdates();
  expect(render.mock.calls.map((args) => args[0])).toEqual([3, 5]);
  state.a = 3;
  state.b = 2;
  await flushUpdates();
  expect(render).toHaveBeenCalledTimes(2);
  destroyComponent(host, false);
  expect((state as unknown as ViewModel)[VM_WATCHERS]?.size).toBe(0);
});
test('destroying an expression binding cancels pending updates', async () => {
  const state = vm({ n: 1 });
  const render = jestApi.fn();
  const host = createHost();
  watchForRender(
    ExprWatcher([PathWatcher(state as unknown as ViewModel, ['n'])], (v) => Number(v) * 2),
    render,
    host,
  );
  state.n = 2;
  destroyComponent(host, false);
  await flushUpdates();
  expect(render).toHaveBeenCalledTimes(1);
});
test('dynamic paths rebind when the index changes and ignore the previous target', async () => {
  const state = vm({ index: 0, items: [{ name: 'a' }, { name: 'b' }] });
  const host = createHost();
  const render = jestApi.fn();
  watchForRender(
    DymPathWatcher(state as unknown as ViewModel, [
      'items',
      PathWatcher(state as unknown as ViewModel, ['index']),
      'name',
    ]),
    render,
    host,
  );
  state.index = 1;
  await flushUpdates();
  expect(render).toHaveBeenLastCalledWith('b');
  state.items[0].name = 'old';
  await flushUpdates();
  expect(render).toHaveBeenCalledTimes(2);
  state.items[1].name = 'new';
  await flushUpdates();
  expect(render).toHaveBeenLastCalledWith('new');
});
test('path event binding replaces handlers, handles undefined and unbinds on destruction', async () => {
  const a = jestApi.fn();
  const b = jestApi.fn();
  const state = vm<{ handler: ((event: Event) => void) | undefined }>({ handler: a });
  const host = createHost();
  const button = document.createElement('button');
  watchPathForDOMEventBind(
    state as unknown as ViewModel,
    ['handler'],
    button,
    'click',
    false,
    host,
  );
  button.click();
  state.handler = b;
  await flushUpdates();
  button.click();
  expect(a).toHaveBeenCalledTimes(1);
  expect(b).toHaveBeenCalledTimes(1);
  state.handler = undefined;
  await flushUpdates();
  button.click();
  expect(b).toHaveBeenCalledTimes(1);
  state.handler = a;
  await flushUpdates();
  destroyComponent(host, false);
  button.click();
  expect(a).toHaveBeenCalledTimes(1);
});
test('watcher-based event bindings follow selected handler changes', async () => {
  const a = jestApi.fn();
  const b = jestApi.fn();
  const state = vm({ handler: a });
  const host = createHost();
  const button = document.createElement('button');
  watchForDOMEventBind(
    PathWatcher(state as unknown as ViewModel, ['handler']),
    button,
    'click',
    false,
    host,
  );
  button.click();
  state.handler = b;
  await flushUpdates();
  button.click();
  destroyComponent(host, false);
  button.click();
  expect(a).toHaveBeenCalledTimes(1);
  expect(b).toHaveBeenCalledTimes(1);
});

test('missing binding targets yield undefined text and do not attach events', () => {
  const render = jestApi.fn();
  const host = createHost();
  watchPathForRender(undefined as unknown as ViewModel, ['name'], render, host);
  expect(render).toHaveBeenCalledWith(undefined);
  const node = document.createElement('button');
  expect(() =>
    watchPathForDOMEventBind(
      undefined as unknown as ViewModel,
      ['click'],
      node,
      'click',
      false,
      host,
    ),
  ).not.toThrow();
});
test('plain object event bindings invoke their initial handler without installing a VM watcher', () => {
  const handler = jestApi.fn();
  const value = { handler };
  const node = document.createElement('button');
  watchPathForDOMEventBind(
    value as unknown as ViewModel,
    ['handler'],
    node,
    'click',
    false,
    createHost(),
  );
  node.click();
  expect(handler).toHaveBeenCalledTimes(1);
  expect((value as any)[VM_WATCHERS]).toBeUndefined();
});
test('plain object PathWatcher can be rendered and destroyed', () => {
  const host = createHost();
  const render = jestApi.fn();
  watchForRender(PathWatcher({ name: 'plain' } as unknown as ViewModel, ['name']), render, host);
  expect(render).toHaveBeenCalledWith('plain');
  destroyComponent(host, false);
});
test('destroying a render binding cancels an already scheduled expression recomputation', async () => {
  const host = createHost();
  const state = vm({ n: 1 });
  const render = jestApi.fn();
  watchForRender(
    ExprWatcher([PathWatcher(state as unknown as ViewModel, ['n'])], (v) => Number(v) * 2),
    render,
    host,
  );
  state.n = 2;
  // The VM notification queues the expression's separate microtask. Unmount
  // between them to verify the expression task is cancelled as well.
  await Promise.resolve();
  destroyComponent(host, false);
  await flushUpdates();
  expect(render).toHaveBeenCalledTimes(1);
});

test('a dynamic path render callback may unmount without recreating subscriptions', async () => {
  const state = vm({ index: 0, items: ['a', 'b'] });
  const host = createHost();
  watchForRender(
    DymPathWatcher(state as unknown as ViewModel, [
      'items',
      PathWatcher(state as unknown as ViewModel, ['index']),
    ]),
    (v) => {
      if (v === 'b') destroyComponent(host, false);
    },
    host,
  );
  state.index = 1;
  await flushUpdates();
  expect((state as unknown as ViewModel)[VM_WATCHERS]?.size).toBe(0);
});

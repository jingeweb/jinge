import {
  ExprWatcher,
  MethodPathWatcher,
  PathWatcher,
  VM_WATCHERS,
  type ViewModel,
  destroyComponent,
  vm,
  watchForRender,
} from '../../src';
import { createHost, flushUpdates, jestApi, setupRuntimeTests } from '../_helper';
setupRuntimeTests();
function invoke(value: unknown, ...args: unknown[]) {
  return Reflect.apply(value as (...args: unknown[]) => unknown, undefined, args);
}
function bind(state: object, path: Parameters<typeof MethodPathWatcher>[1], args: unknown[] = []) {
  const render = jestApi.fn(),
    host = createHost();
  watchForRender(
    ExprWatcher([MethodPathWatcher(state as ViewModel, path)], (fn) => invoke(fn, ...args)),
    render,
    host,
  );
  return { render, host };
}
test('method watcher retains this and follows receiver replacement even when the method is shared', async () => {
  function label(this: { name: string }) {
    return this.name;
  }
  const state = vm({ service: { name: 'Alice', label } }),
    { render } = bind(state, ['service', 'label']);
  expect(render).toHaveBeenLastCalledWith('Alice');
  state.service = { name: 'Bob', label };
  await flushUpdates();
  expect(render).toHaveBeenLastCalledWith('Bob');
});
test('method replacement alone rebinds the invocation and ignores an overridden function.call', async () => {
  function label(this: { name: string }) {
    return this.name;
  }
  Object.defineProperty(label, 'call', {
    value: () => {
      throw new Error('must use intrinsic application');
    },
  });
  const state = vm({ service: { name: 'Alice', label } }),
    { render } = bind(state, ['service', 'label']);
  state.service.label = function (this: { name: string }) {
    return `${this.name}!`;
  };
  await flushUpdates();
  expect(render).toHaveBeenLastCalledWith('Alice!');
});
test('primitive receivers change even though String.prototype.trim stays identical', async () => {
  const state = vm({ text: ' Alice ' }),
    { render } = bind(state, ['text', 'trim']);
  state.text = ' Bob ';
  await flushUpdates();
  expect(render.mock.calls.map((args) => args[0])).toEqual(['Alice', 'Bob']);
});
test('method bindings are stable and neither receiver fields nor unrelated fields create deep dependencies', async () => {
  const state = vm({
    service: {
      name: 'Alice',
      label(this: { name: string }) {
        return this.name;
      },
    },
    other: 0,
  });
  const calls = jestApi.fn(),
    host = createHost();
  watchForRender(
    MethodPathWatcher(state as unknown as ViewModel, ['service', 'label']),
    calls,
    host,
  );
  const first = calls.mock.calls[0][0];
  state.service.name = 'Bob';
  state.other++;
  await flushUpdates();
  expect(calls).toHaveBeenCalledTimes(1);
  expect(invoke(first)).toBe('Bob');
});
test('a root VM receiver is not deep-watched when one of its data fields changes', async () => {
  const state = vm({
      name: 'Alice',
      label(this: { name: string }) {
        return this.name;
      },
    }),
    { render } = bind(state, ['label']);
  state.name = 'Bob';
  await flushUpdates();
  expect(render).toHaveBeenCalledTimes(1);
  state.label = function (this: { name: string }) {
    return `${this.name}!`;
  };
  await flushUpdates();
  expect(render).toHaveBeenLastCalledWith('Bob!');
});
test('dynamic receiver and dynamic method keys rebind and unsubscribe old targets', async () => {
  function label(this: { name: string }) {
    return this.name;
  }
  const state = vm({
    index: 0,
    key: 'label',
    services: [
      { name: 'A', label, other: label },
      {
        name: 'B',
        label,
        other(this: { name: string }) {
          return `${this.name}!`;
        },
      },
    ],
  });
  const { render, host } = bind(state, [
    'services',
    PathWatcher(state as unknown as ViewModel, ['index']),
    PathWatcher(state as unknown as ViewModel, ['key']),
  ]);
  state.index = 1;
  state.key = 'other';
  await flushUpdates();
  expect(render).toHaveBeenLastCalledWith('B!');
  const count = render.mock.calls.length;
  state.services[0].label = () => 'old';
  await flushUpdates();
  expect(render).toHaveBeenCalledTimes(count);
  destroyComponent(host, false);
  expect((state as unknown as ViewModel)[VM_WATCHERS]?.size).toBe(0);
  expect((state.services[1] as unknown as ViewModel)[VM_WATCHERS]?.size).toBe(0);
});
test('method getters are not read twice when constructing the two subscriptions', () => {
  let reads = 0;
  function label(this: { name: string }) {
    return this.name;
  }
  const state = vm({
    service: {
      name: 'A',
      get label() {
        reads++;
        return label;
      },
    },
  });
  reads = 0;
  const { render } = bind(state, ['service', 'label']);
  expect(render).toHaveBeenLastCalledWith('A');
  expect(reads).toBe(1);
});
test('destroying a binding cancels pending method/receiver updates and removes both subscriptions', async () => {
  const state = vm({
      service: {
        name: 'A',
        label(this: { name: string }) {
          return this.name;
        },
      },
    }),
    { render, host } = bind(state, ['service', 'label']);
  state.service.label = () => 'late';
  destroyComponent(host, false);
  await flushUpdates();
  expect(render).toHaveBeenCalledTimes(1);
  expect((state as unknown as ViewModel)[VM_WATCHERS]?.size).toBe(0);
  expect((state.service as unknown as ViewModel)[VM_WATCHERS]?.size).toBe(0);
});
test('optional receivers and optional methods preserve distinct missing-method behavior', async () => {
  type Service = { name: string; label?: (this: { name: string }) => string };
  const state = vm<{ service: Service | null }>({ service: null }),
    calls = jestApi.fn();
  watchForRender(
    MethodPathWatcher(state as unknown as ViewModel, ['service', 'label'], true, false),
    calls,
    createHost(),
  );
  expect(calls.mock.calls.at(-1)?.[0]).toBeUndefined();
  state.service = { name: 'A' };
  await flushUpdates();
  expect(() => invoke(calls.mock.calls.at(-1)?.[0])).toThrow(TypeError);
  state.service.label = function () {
    return this.name;
  };
  await flushUpdates();
  expect(invoke(calls.mock.calls.at(-1)?.[0])).toBe('A');
  const optional = jestApi.fn();
  watchForRender(
    MethodPathWatcher(state as unknown as ViewModel, ['service', 'label'], false, true),
    optional,
    createHost(),
  );
  state.service.label = undefined;
  await flushUpdates();
  expect(optional.mock.calls.at(-1)?.[0]).toBeUndefined();
});
test('a failing method getter does not leak either subscription during construction', () => {
  let fail = false;
  const state = vm({
    service: {
      get label() {
        if (fail) throw new Error('bad getter');
        return () => 'ok';
      },
    },
  });
  fail = true;
  expect(() => MethodPathWatcher(state as unknown as ViewModel, ['service', 'label'])).toThrow(
    'bad getter',
  );
  expect((state as unknown as ViewModel)[VM_WATCHERS]?.size ?? 0).toBe(0);
  expect((state.service as unknown as ViewModel)[VM_WATCHERS]?.size ?? 0).toBe(0);
});

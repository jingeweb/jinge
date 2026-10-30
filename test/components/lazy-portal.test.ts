import {
  type FC,
  type JNode,
  type ComponentHost,
  DEFAULT_SLOT_NAME,
  ROOT_NODES,
  Lazy,
  Portal,
  addMountFn,
  addUnmountFn,
  destroyComponent,
  getComponentContext,
  lazy,
  renderFunctionComponent,
  handleRenderDone,
} from '../../src';
import {
  createHost,
  deferred,
  elementSlot,
  flushUpdates,
  jestApi,
  mount,
  setupRuntimeTests,
} from '../_helper';
setupRuntimeTests();
test('Lazy replaces a loading slot after its loader resolves', async () => {
  const task = deferred<FC>();
  const cleanup = jestApi.fn();
  const loading: FC = (_, h) => {
    addUnmountFn(h, cleanup);
    return elementSlot('i', 'loading')(_, h);
  };
  mount(Lazy, { loader: () => task.promise, 'slot:loading': loading });
  expect(document.body.textContent).toBe('loading');
  task.resolve(elementSlot('b', 'loaded'));
  await flushUpdates();
  expect(document.body.textContent).toBe('loaded');
  expect(cleanup).toHaveBeenCalledTimes(1);
});
test('Lazy starts with a placeholder if no loading slot is supplied', async () => {
  const task = deferred<FC>();
  mount(Lazy, { loader: () => task.promise });
  expect(document.body.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
  task.resolve(elementSlot('b', 'done'));
  await flushUpdates();
  expect(document.body.textContent).toBe('done');
});
test('Lazy forwards errors to its error slot', async () => {
  const task = deferred<FC>();
  const error = new Error('load failed');
  const report = jestApi.spyOn(console, 'error').mockImplementation(() => {});
  mount(Lazy, {
    loader: () => task.promise,
    'slot:error': (p: { error: Error }, h?: ComponentHost) =>
      elementSlot('p', p.error.message)(p, h!) as JNode,
  });
  task.reject(error);
  await flushUpdates();
  expect(document.body.textContent).toBe('load failed');
  expect(report).toHaveBeenCalledWith(error);
});
test('Lazy ignores a result that resolves after unmount', async () => {
  const task = deferred<FC>();
  const component = jestApi.fn(elementSlot('b', 'late'));
  const host = mount(Lazy, { loader: () => task.promise });
  destroyComponent(host);
  task.resolve(component);
  await flushUpdates();
  expect(component).not.toHaveBeenCalled();
  expect(document.body.childNodes).toHaveLength(0);
});
test('Lazy keeps its loading content after a rejection without an error slot', async () => {
  jestApi.spyOn(console, 'error').mockImplementation(() => {});
  const task = deferred<FC>();
  mount(Lazy, { loader: () => task.promise, 'slot:loading': elementSlot('i', 'waiting') });
  task.reject(new Error('failed'));
  await flushUpdates();
  expect(document.body.textContent).toBe('waiting');
});
test('lazy factory forwards props and configures its loading component', async () => {
  const task = deferred<FC>();
  const Wrapped = lazy(() => task.promise, { 'slot:loading': elementSlot('i', 'loading') });
  mount(Wrapped, { label: 'forwarded' });
  expect(document.body.textContent).toBe('loading');
  task.resolve((p, h) => elementSlot('b', p.label)(p, h));
  await flushUpdates();
  expect(document.body.textContent).toBe('forwarded');
});
test('Portal renders into its target, inherits context and cleans up on unmount', () => {
  const target = document.createElement('aside');
  document.body.append(target);
  const events: string[] = [];
  let ported: ComponentHost | undefined;
  const slot: FC = (_, h) => {
    ported = h;
    addMountFn(h, () => events.push('mounted'));
    addUnmountFn(h, () => events.push('unmounted'));
    return elementSlot('b', 'ported')(_, h);
  };
  const host = mount(Portal, { target, [DEFAULT_SLOT_NAME]: slot }, document.body, {
    theme: 'dark',
  });
  expect(target.textContent).toBe('ported');
  expect(document.body.lastChild?.nodeType).toBe(Node.COMMENT_NODE);
  expect(getComponentContext(ported!, 'theme')).toBe('dark');
  expect(events).toEqual(['mounted']);
  expect((host as ComponentHost & { getPortedHost(): ComponentHost }).getPortedHost()).toBe(ported);
  destroyComponent(host);
  expect(target.childNodes).toHaveLength(0);
  expect(events).toEqual(['mounted', 'unmounted']);
});
test('Portal defaults to body and permits an absent slot', () => {
  const host = mount(Portal, { [DEFAULT_SLOT_NAME]: elementSlot('b', 'body') });
  expect(document.body.querySelector('b')?.textContent).toBe('body');
  destroyComponent(host);
  expect(document.body.childNodes).toHaveLength(0);
  const empty = mount(Portal);
  expect(empty[ROOT_NODES]).toHaveLength(1);
  expect(document.body.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
});

test('Lazy reports a loader that resolves to a non-component', async () => {
  const report = jestApi.spyOn(console, 'error').mockImplementation(() => {});
  mount(Lazy, {
    loader: () => Promise.resolve(42),
    'slot:error': (p: { error: Error }, h?: ComponentHost) =>
      elementSlot('p', p.error.message)(p, h!) as JNode,
  });
  await flushUpdates();
  expect(document.body.textContent).toContain('loader 函数未返回函数组件');
  expect(report).toHaveBeenCalledTimes(1);
});
test('Lazy ignores a rejection that arrives after unmount', async () => {
  const task = deferred<FC>();
  const report = jestApi.spyOn(console, 'error').mockImplementation(() => {});
  const errorSlot = jestApi.fn(elementSlot());
  const host = mount(Lazy, { loader: () => task.promise, 'slot:error': errorSlot });
  destroyComponent(host);
  task.reject(new Error('late'));
  await flushUpdates();
  expect(report).not.toHaveBeenCalled();
  expect(errorSlot).not.toHaveBeenCalled();
});
test('lazy factory can render without props and forwards errors to its configured component', async () => {
  jestApi.spyOn(console, 'error').mockImplementation(() => {});
  const task = deferred<FC>();
  const Wrapped = lazy(() => task.promise, {
    'slot:error': (p: { error: Error }, h?: ComponentHost) =>
      elementSlot('p', p.error.message)(p, h!) as JNode,
  });
  const host = createHost();
  document.body.append(...renderFunctionComponent(host, Wrapped));
  handleRenderDone(host);
  task.reject(new Error('factory error'));
  await flushUpdates();
  expect(document.body.textContent).toBe('factory error');
});

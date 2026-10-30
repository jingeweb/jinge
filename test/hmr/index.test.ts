import {
  type ComponentHost,
  type FC,
  CONTEXT,
  ROOT_NODES,
  destroyComponent,
  getComponentContext,
  initHmr,
  lazy,
  textRenderFn,
} from '../../src';
import {
  createHost,
  flushUpdates,
  elementSlot,
  jestApi,
  mount,
  setupRuntimeTests,
} from '../_helper';
setupRuntimeTests();
test('HMR returns the latest registered function and leaves unregistered functions unchanged', () => {
  initHmr();
  const hmr = window.__JINGE_HMR__!;
  const old = elementSlot('b', 'old');
  const next = elementSlot('i', 'new');
  const unknown = elementSlot();
  hmr.registerFunctionComponent(old, 'unit/component');
  hmr.registerFunctionComponent(next, 'unit/component');
  expect(hmr.getLatestFunctionComponent(old)).toBe(next);
  expect(hmr.getLatestFunctionComponent(unknown)).toBe(unknown);
});
test('HMR replaces all live instances while preserving props, context and neighboring nodes', () => {
  initHmr();
  const hmr = window.__JINGE_HMR__!;
  const old: FC = (p, h) => [textRenderFn(h, `old:${p.label}`)];
  hmr.registerFunctionComponent(old, 'unit/live');
  const first = mount(old, { label: 'a' }, document.body, { theme: 'dark' });
  const second = mount(old, { label: 'b' });
  const sibling = document.createElement('aside');
  document.body.append(sibling);
  const next: FC = (p, h) => [textRenderFn(h, `new:${p.label}`)];
  hmr.registerFunctionComponent(next, 'unit/live');
  hmr.replaceComponentInstance(next);
  expect(document.body.textContent).toBe('new:anew:b');
  expect(getComponentContext(first, 'theme')).toBe('dark');
  expect(first[CONTEXT]?.theme).toBe('dark');
  expect(second[ROOT_NODES]).toHaveLength(1);
  expect(document.body.lastChild).toBe(sibling);
});
test('destroyed HMR instances are deregistered before a later update', () => {
  initHmr();
  const hmr = window.__JINGE_HMR__!;
  const old = elementSlot('b', 'old');
  hmr.registerFunctionComponent(old, 'unit/destroy');
  const host = mount(old);
  destroyComponent(host);
  const next = jestApi.fn((_: unknown, h: ComponentHost) => [textRenderFn(h, 'new')]);
  hmr.registerFunctionComponent(next, 'unit/destroy');
  hmr.replaceComponentInstance(next);
  expect(next).not.toHaveBeenCalled();
  expect(document.body.childNodes).toHaveLength(0);
});
test('rendering an old function uses its latest registered implementation', () => {
  initHmr();
  const hmr = window.__JINGE_HMR__!;
  const old = elementSlot('b', 'old');
  const next = elementSlot('i', 'new');
  hmr.registerFunctionComponent(old, 'unit/latest');
  hmr.registerFunctionComponent(next, 'unit/latest');
  mount(old);
  expect(document.body.textContent).toBe('new');
});

test('HMR ignores anonymous updates and warns when registering an unregistered function instance', () => {
  initHmr();
  const hmr = window.__JINGE_HMR__!;
  const report = jestApi.spyOn(console, 'warn').mockImplementation(() => {});
  const anonymous = elementSlot();
  const host = createHost();
  hmr.registerComponentInstance(anonymous, host);
  hmr.replaceComponentInstance(anonymous);
  expect(report).toHaveBeenCalledTimes(1);
  hmr.registerFunctionComponent(anonymous, 'unit/no-instance');
  expect(() => hmr.replaceComponentInstance(anonymous)).not.toThrow();
});
test('HMR leaves functions from another runtime registry usable and registers lazy factories', async () => {
  initHmr();
  const previous = elementSlot();
  window.__JINGE_HMR__!.registerFunctionComponent(previous, 'unit/old-registry');
  initHmr();
  expect(window.__JINGE_HMR__!.getLatestFunctionComponent(previous)).toBe(previous);
  const Wrapped = lazy(() => Promise.resolve(elementSlot('b', 'loaded')));
  mount(Wrapped);
  await flushUpdates();
  expect(document.body.textContent).toBe('loaded');
});

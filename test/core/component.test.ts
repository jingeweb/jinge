import {
  type ComponentHost,
  COMPONENT_STATE_DESTROIED,
  COMPONENT_STATE_INITIALIZE,
  COMPONENT_STATE_RENDERED,
  CONTEXT,
  NON_ROOT_COMPONENT_NODES,
  ROOT_NODES,
  STATE,
  addMountFn,
  addUnmountFn,
  bootstrap,
  destroyComponent,
  destroyComponentContent,
  getComponentContext,
  getCurrentComponentHost,
  onUnmount,
  getFirstDOM,
  getLastDOM,
  handleRenderDone,
  isComponent,
  renderFunctionComponent,
  renderSlotFunction,
  replaceRenderFunctionComponent,
  resetComponent,
  setComponentContext,
  textRenderFn,
} from '../../src';
import { createHost, elementSlot, jestApi, mount, setupRuntimeTests, trackHost } from '../_helper';
setupRuntimeTests();
test('bootstrap replaces a mount placeholder and preserves adjacent nodes', () => {
  const before = document.createElement('aside');
  const target = document.createElement('div');
  const after = document.createElement('footer');
  document.body.append(before, target, after);
  const host = trackHost(bootstrap(elementSlot('main', 'app'), target));
  expect(document.body.children[1].tagName).toBe('MAIN');
  expect(before.isConnected && after.isConnected).toBe(true);
  expect(host[STATE]).toBe(COMPONENT_STATE_RENDERED);
  destroyComponent(host);
  expect(document.body.children).toHaveLength(2);
});
test('bootstrap on body appends multiple roots without removing existing content', () => {
  document.body.textContent = 'existing';
  const host = trackHost(
    bootstrap((_, h) => [textRenderFn(h, 'a'), textRenderFn(h, 'b')], document.body),
  );
  expect(document.body.textContent).toBe('existingab');
  expect(host[ROOT_NODES]).toHaveLength(2);
});
test('nested root hosts expose their first and last real DOM nodes', () => {
  const parent = createHost();
  const child = createHost();
  const a = textRenderFn(child, 'a');
  const b = textRenderFn(child, 'b');
  parent[ROOT_NODES].push(child);
  expect(getFirstDOM(parent)).toBe(a);
  expect(getLastDOM(parent)).toBe(b);
  expect(isComponent(child)).toBe(true);
  expect(isComponent(a)).toBe(false);
});
test('mount hooks run child-first, once, and register returned cleanup functions', () => {
  const events: string[] = [];
  const parent = createHost();
  const child = createHost();
  parent[ROOT_NODES].push(child);
  child[ROOT_NODES].push(document.createTextNode('x'));
  addMountFn(parent, () => {
    events.push('parent');
    return () => events.push('cleanup');
  });
  addMountFn(child, () => events.push('child'));
  handleRenderDone(parent);
  handleRenderDone(parent);
  expect(events).toEqual(['child', 'parent']);
  destroyComponent(parent, false);
  destroyComponent(parent, false);
  expect(events).toEqual(['child', 'parent', 'cleanup']);
});
test('destroy clears root and nested component resources exactly once', () => {
  const parent = createHost();
  const nested = createHost();
  const node = document.createElement('div');
  parent[ROOT_NODES].push(node);
  parent[NON_ROOT_COMPONENT_NODES].push(nested);
  nested[ROOT_NODES].push(document.createElement('span'));
  node.append(nested[ROOT_NODES][0] as Node);
  document.body.append(node);
  const cleanup = jestApi.fn();
  addUnmountFn(nested, cleanup);
  destroyComponent(parent);
  expect(node.isConnected).toBe(false);
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(nested[STATE]).toBe(COMPONENT_STATE_DESTROIED);
});
test('destroyComponentContent preserves the host lifecycle and context', () => {
  const host = mount(elementSlot(), {}, document.body, { theme: 'dark' });
  const cleanup = jestApi.fn();
  addUnmountFn(host, cleanup);
  destroyComponentContent(host);
  expect(document.body.childNodes).toHaveLength(0);
  expect(host[STATE]).toBe(COMPONENT_STATE_RENDERED);
  expect(host[CONTEXT]?.theme).toBe('dark');
  expect(cleanup).not.toHaveBeenCalled();
});
test('context updates copy inherited state without affecting siblings', () => {
  const inherited = { theme: 'light' };
  const a = createHost(inherited);
  const b = createHost(inherited);
  setComponentContext(a, 'theme', 'dark');
  expect(getComponentContext(a, 'theme')).toBe('dark');
  expect(getComponentContext(b, 'theme')).toBe('light');
  expect(inherited.theme).toBe('light');
});
test('reset removes rendered content and permits setting new context', () => {
  const host = mount(elementSlot());
  resetComponent(host, { theme: 'new' });
  expect(host[STATE]).toBe(COMPONENT_STATE_INITIALIZE);
  expect(document.body.childNodes).toHaveLength(0);
  setComponentContext(host, 'theme', 'updated');
  expect(getComponentContext(host, 'theme')).toBe('updated');
});
test('replacing a rendered function preserves neighboring DOM and runs cleanup', () => {
  const cleanup = jestApi.fn();
  const host = mount((_, h) => {
    addUnmountFn(h, cleanup);
    return elementSlot('span', 'old')(_, h);
  });
  const sibling = document.createElement('aside');
  document.body.append(sibling);
  replaceRenderFunctionComponent(host, elementSlot('b', 'new'), undefined, {});
  expect(document.body.textContent).toBe('new');
  expect(document.body.lastChild).toBe(sibling);
  expect(cleanup).toHaveBeenCalledTimes(1);
  replaceRenderFunctionComponent(host, undefined, undefined, {}, 'empty');
  expect(document.body.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
});
test('slot rendering receives props and missing slots return no nodes', () => {
  const host = createHost();
  const props = { label: 'slot' };
  const slot = jestApi.fn((p: typeof props, h: ComponentHost) => [textRenderFn(h, p.label)]);
  expect(renderSlotFunction(host, undefined)).toEqual([]);
  const nodes = renderSlotFunction(host, slot, props);
  expect(nodes[0].textContent).toBe('slot');
  expect(slot).toHaveBeenCalledWith(props, host);
});
test('render passes the host and props to the component', () => {
  const host = createHost();
  const props = { n: 1 };
  const component = jestApi.fn((_: unknown, h: ComponentHost) => [textRenderFn(h, 'ok')]);
  renderFunctionComponent(host, component, props);
  expect(component).toHaveBeenCalledWith(props, host);
});

test('context cannot change after rendering completes', () => {
  const host = mount(elementSlot());
  expect(() => setComponentContext(host, 'late', 1)).toThrow(
    "Can't setContext after component has been rendered",
  );
});
test('function components and slots must return at least one rendered node', () => {
  expect(() => renderFunctionComponent(createHost(), () => [])).toThrow(
    'function component render result is empty',
  );
  expect(() => renderSlotFunction(createHost(), () => [])).toThrow(
    'function component render result is empty',
  );
});
test('component replacement supports multiple roots', () => {
  const host = mount(elementSlot());
  replaceRenderFunctionComponent(
    host,
    (_, h) => [textRenderFn(h, 'a'), textRenderFn(h, 'b')],
    undefined,
    {},
  );
  expect(document.body.textContent).toBe('ab');
  expect(document.body.childNodes).toHaveLength(2);
});

test('nested rendering restores the parent host after successful and failed child renders', () => {
  const child = createHost();
  let parentHost: ComponentHost | undefined;
  const parent = mount((_, h) => {
    parentHost = h;
    renderFunctionComponent(child, elementSlot());
    expect(getCurrentComponentHost()).toBe(h);
    expect(() =>
      renderFunctionComponent(createHost(), () => {
        throw new Error('child failure');
      }),
    ).toThrow('child failure');
    expect(getCurrentComponentHost()).toBe(h);
    onUnmount(() => {});
    return [textRenderFn(h, 'parent')];
  });
  expect(parent).toBe(parentHost);
  expect(() => getCurrentComponentHost()).toThrow('global component not found');
});
test('a throwing slot restores the parent host and leaves the original error intact', () => {
  const parent = mount((_, h) => {
    expect(() =>
      renderSlotFunction(createHost(), () => {
        throw new Error('slot failure');
      }),
    ).toThrow('slot failure');
    expect(getCurrentComponentHost()).toBe(h);
    return [textRenderFn(h, 'parent')];
  });
  expect(parent[STATE]).toBe(COMPONENT_STATE_RENDERED);
});

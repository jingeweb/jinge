import {
  ComponentHost,
  type FC,
  type ViewModel,
  DEFAULT_SLOT_NAME,
  ROOT_NODES,
  Dynamic,
  For,
  If,
  KEY_DATA,
  KEY_INDEX,
  addUnmountFn,
  destroyComponent,
  vm,
  textRenderFn,
  watchPathForRender,
} from '../../src';
import { elementSlot, flushUpdates, jestApi, mount, setupRuntimeTests } from '../_helper';
setupRuntimeTests();
test('If switches branches and disposes each old branch', async () => {
  const cleanup = jestApi.fn();
  const yes: FC = (_, h) => {
    addUnmountFn(h, cleanup);
    return elementSlot('b', 'yes')(_, h);
  };
  const props = vm({ expect: true, [DEFAULT_SLOT_NAME]: yes, 'slot:else': elementSlot('i', 'no') });
  const host = mount(If, props);
  expect(document.body.textContent).toBe('yes');
  props.expect = false;
  await flushUpdates();
  expect(document.body.textContent).toBe('no');
  expect(cleanup).toHaveBeenCalledTimes(1);
  props.expect = true;
  await flushUpdates();
  expect(document.body.textContent).toBe('yes');
  destroyComponent(host);
  expect(cleanup).toHaveBeenCalledTimes(2);
});
test('If uses a placeholder for a missing branch and can later render content', async () => {
  const props = vm({ expect: false, [DEFAULT_SLOT_NAME]: elementSlot('b', 'visible') });
  mount(If, props);
  expect(document.body.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
  props.expect = true;
  await flushUpdates();
  expect(document.body.textContent).toBe('visible');
});
test('Dynamic switches components, forwards props and handles an empty selection', async () => {
  const cleanup = jestApi.fn();
  const A: FC = (p, h) => {
    addUnmountFn(h, cleanup);
    return elementSlot('b', p.label)(p, h);
  };
  const B = elementSlot('i', 'second');
  const props = vm<{ fc: FC | undefined; label: string }>({ fc: A, label: 'first' });
  mount(Dynamic, props);
  expect(document.body.textContent).toBe('first');
  props.fc = B;
  await flushUpdates();
  expect(document.body.textContent).toBe('second');
  expect(cleanup).toHaveBeenCalledTimes(1);
  props.fc = undefined;
  await flushUpdates();
  expect(document.body.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
  props.fc = A;
  await flushUpdates();
  expect(document.body.textContent).toBe('first');
});
interface Row {
  id: number;
  name: string;
}
function listProps(items: Row[], key?: keyof Row | typeof KEY_DATA | typeof KEY_INDEX) {
  return vm({
    loop: vm(items),
    key,
    [DEFAULT_SLOT_NAME]: (each: { data: Row; index: number }, host: ComponentHost) => {
      const span = document.createElement('span');
      host[ROOT_NODES].push(span);
      watchPathForRender(
        each as unknown as ViewModel,
        ['data', 'name'],
        (v) => (span.textContent = String(v)),
        host,
      );
      return [span];
    },
  });
}
test('keyed For reorders existing nodes and updates data without remounting matching keys', async () => {
  const props = listProps(
    [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
      { id: 3, name: 'c' },
    ],
    'id',
  );
  mount(For, props);
  const nodes = [...document.querySelectorAll('span')];
  props.loop.reverse();
  await flushUpdates();
  expect([...document.querySelectorAll('span')]).toEqual(nodes.toReversed());
  props.loop = [
    { id: 3, name: 'C' },
    { id: 1, name: 'A' },
  ];
  await flushUpdates();
  expect(document.body.textContent).toBe('CA');
  expect([...document.querySelectorAll('span')]).toEqual([nodes[2], nodes[0]]);
  expect(nodes[1].isConnected).toBe(false);
});
test('For updates nested item properties without replacing the row DOM', async () => {
  const props = listProps([{ id: 1, name: 'a' }], 'id');
  mount(For, props);
  const node = document.querySelector('span');
  props.loop[0].name = 'updated';
  await flushUpdates();
  expect(node?.textContent).toBe('updated');
  expect(document.querySelector('span')).toBe(node);
});
test('For handles empty to populated to empty transitions', async () => {
  const props = listProps([], 'id');
  mount(For, props);
  expect(document.body.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
  props.loop.push({ id: 1, name: 'a' });
  await flushUpdates();
  expect(document.body.textContent).toBe('a');
  props.loop.length = 0;
  await flushUpdates();
  expect(document.body.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
  expect(document.querySelectorAll('span')).toHaveLength(0);
});
test('unkeyed For reuses positions and removes extra rows', async () => {
  const props = listProps([
    { id: 1, name: 'a' },
    { id: 2, name: 'b' },
  ]);
  mount(For, props);
  const first = document.querySelector('span');
  props.loop = [{ id: 3, name: 'c' }];
  await flushUpdates();
  expect(document.body.textContent).toBe('c');
  expect(document.querySelector('span')).toBe(first);
  expect(document.querySelectorAll('span')).toHaveLength(1);
});
test.each([KEY_DATA, KEY_INDEX] as const)(
  'For supports the built-in %p key strategy',
  async (key) => {
    const a = { id: 1, name: 'a' };
    const b = { id: 2, name: 'b' };
    const props = listProps([a, b], key);
    mount(For, props);
    const first = document.querySelector('span');
    props.loop.reverse();
    await flushUpdates();
    expect(document.body.textContent).toBe('ba');
    expect(document.querySelectorAll('span')[key === KEY_DATA ? 1 : 0]).toBe(first);
  },
);
test('For stops observing its input when destroyed', async () => {
  const props = listProps([{ id: 1, name: 'a' }], 'id');
  const host = mount(For, props);
  destroyComponent(host);
  props.loop.push({ id: 2, name: 'b' });
  await flushUpdates();
  expect(document.body.childNodes).toHaveLength(0);
});

test('Dynamic can render its first component after an initially empty selection', async () => {
  const props = vm<{ fc?: FC }>({});
  mount(Dynamic, props);
  expect(document.body.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
  props.fc = elementSlot('b', 'ready');
  await flushUpdates();
  expect(document.body.textContent).toBe('ready');
});
test('For renders a non-reactive list and an absent slot as static content and a placeholder', () => {
  mount(For, {
    loop: [{ name: 'plain' }],
    [DEFAULT_SLOT_NAME]: (each: { data: { name: string } }, h: ComponentHost) =>
      elementSlot('b', each.data.name)(each, h),
  });
  expect(document.body.textContent).toBe('plain');
  mount(For, { loop: [1] });
  expect(document.body.lastChild?.nodeType).toBe(Node.COMMENT_NODE);
});
test('For keeps one placeholder across empty and null input changes', async () => {
  const props = vm<{ loop: { name: string }[] | null | undefined; 'slot:default': FC }>({
    loop: [],
    [DEFAULT_SLOT_NAME]: elementSlot(),
  });
  mount(For, props);
  const placeholder = document.body.firstChild;
  props.loop = null;
  await flushUpdates();
  props.loop = undefined;
  await flushUpdates();
  expect(document.body.firstChild).toBe(placeholder);
  expect(document.body.childNodes).toHaveLength(1);
});
test('For tolerates input updates when no item slot exists', async () => {
  const props = vm({ loop: [1] });
  mount(For, props);
  props.loop.push(2);
  await flushUpdates();
  expect(document.body.childNodes).toHaveLength(1);
  expect(document.body.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
});
test('keyed For inserts multiple new roots and recursively moves nested component roots', async () => {
  const props = vm({
    loop: [{ id: 1 }, { id: 2 }],
    key: '["id"]',
    [DEFAULT_SLOT_NAME]: (each: { data: { id: number } }, h: ComponentHost) => {
      const child = new ComponentHost();
      h[ROOT_NODES].push(child);
      return [textRenderFn(child, String(each.data.id)), textRenderFn(child, ':')];
    },
  });
  mount(For, props);
  const old = [...document.body.childNodes];
  props.loop = [{ id: 2 }, { id: 3 }, { id: 1 }];
  await flushUpdates();
  expect(document.body.textContent).toBe('2:3:1:');
  expect(document.body.firstChild).toBe(old[2]);
  expect(document.body.childNodes[4]).toBe(old[0]);
});
test('For expands from an empty placeholder into multiple rows', async () => {
  const props = listProps([]);
  mount(For, props);
  props.loop = [
    { id: 1, name: 'a' },
    { id: 2, name: 'b' },
  ];
  await flushUpdates();
  expect(document.body.textContent).toBe('ab');
  expect(document.querySelectorAll('span')).toHaveLength(2);
});

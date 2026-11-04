import {
  type ViewModel,
  getValueByPath,
  vm,
  vmWatch,
  PathWatcher,
  DymPathWatcher,
  watchForRender,
  watchPathForRender,
  destroyComponent,
  VM_WATCHERS,
} from '../../src';
import { cleanupWith, createHost, flushUpdates, setupRuntimeTests } from '../_helper';
setupRuntimeTests();
const cases: [string, unknown, (string | number)[], unknown][] = [
  ['string length', 'jinge', ['length'], 5],
  ['empty length', '', ['length'], 0],
  ['Chinese length', '你好', ['length'], 2],
  ['emoji UTF-16 length', '😀', ['length'], 2],
  ['mixed UTF-16 length', 'a😀b', ['length'], 4],
  ['string index', 'jinge', [1], 'i'],
  ['string index as string', 'jinge', ['1'], 'i'],
  ['surrogate indexing', '😀', [0], '\ud83d'],
  ['out of bounds', 'a', [2], undefined],
  ['nested primitive property', 'abc', [0, 'length'], 1],
  ['zero constructor', 0, ['constructor', 'name'], 'Number'],
  ['false constructor', false, ['constructor', 'name'], 'Boolean'],
  ['empty constructor', '', ['constructor', 'name'], 'String'],
  ['bigint constructor', 1n, ['constructor', 'name'], 'BigInt'],
  ['symbol description', Symbol('label'), ['description'], 'label'],
  [
    'function properties',
    function named(a: unknown) {
      return a;
    },
    ['name'],
    'named',
  ],
  ['missing primitive property', false, ['missing'], undefined],
  ['null short circuit', null, ['length'], undefined],
  ['undefined short circuit', undefined, ['length'], undefined],
  ['missing intermediate', 'abc', ['missing', 'length'], undefined],
  ['array control', [1, 2], ['length'], 2],
  ['boxed string control', Object('abc'), ['length'], 3],
];
test.each(cases)('path property read: %s', (_, value, path, expected) => {
  const keys = ['value', ...path];
  expect(getValueByPath({ value }, keys)).toEqual(expected);
  expect(keys).toEqual(['value', ...path]);
});
test.each([null, undefined, 0, false, 'abc'])(
  'non-object root contract is retained: %p',
  (root) => {
    expect(getValueByPath(root, ['length'])).toBeUndefined();
    expect(getValueByPath(root, [])).toBe(root);
  },
);
test('string length watcher reports initial and changed values, not same-length replacements', async () => {
  const state = vm<{ text: string | null | undefined }>({ text: 'jinge' });
  const values: unknown[] = [];
  cleanupWith(
    vmWatch(state, ['text', 'length'], (value) => values.push(value), { immediate: true }),
  );
  expect(values).toEqual([5]);
  state.text = 'Alice';
  await flushUpdates();
  expect(values).toEqual([5]);
  for (const value of ['', '😀', null, undefined, '你好啊']) {
    state.text = value;
    await flushUpdates();
  }
  expect(values).toEqual([5, 0, 2, undefined, 3]);
});
test('string index watcher observes replacement and out-of-range recovery', async () => {
  const state = vm({ text: 'ab' });
  const values: unknown[] = [];
  cleanupWith(vmWatch(state, ['text', 1], (value) => values.push(value), { immediate: true }));
  for (const text of ['xy', '', '12']) {
    state.text = text;
    await flushUpdates();
  }
  expect(values).toEqual(['b', 'y', undefined, '2']);
});
test('nested nullable string path recovers and stays responsive', async () => {
  const state = vm<{ user: { name: string } | null | undefined }>({ user: null });
  const values: unknown[] = [];
  cleanupWith(
    vmWatch(state, ['user', 'name', 'length'], (value) => values.push(value), { immediate: true }),
  );
  for (const user of [{ name: 'ab' }, { name: '' }, undefined, { name: '😀' }, null]) {
    state.user = user;
    await flushUpdates();
  }
  expect(values).toEqual([undefined, 2, 0, undefined, 2, undefined]);
});
test('render path watcher supports primitive members and releases subscriptions', async () => {
  const state = vm({ name: 'jinge' });
  const host = createHost();
  const node = document.createTextNode('');
  watchPathForRender(
    state as unknown as ViewModel,
    ['name', 'length'],
    (value) => (node.textContent = String(value)),
    host,
  );
  expect(node.textContent).toBe('5');
  state.name = '';
  await flushUpdates();
  expect(node.textContent).toBe('0');
  destroyComponent(host);
  state.name = 'late';
  await flushUpdates();
  expect(node.textContent).toBe('0');
  expect((state as unknown as ViewModel)[VM_WATCHERS]?.size).toBe(0);
});
test('dynamic index watcher switches keys within strings and cleans nested watchers', async () => {
  const state = vm({ text: 'ab', key: 0 });
  const host = createHost();
  const values: unknown[] = [];
  watchForRender(
    DymPathWatcher(state as unknown as ViewModel, [
      'text',
      PathWatcher(state as unknown as ViewModel, ['key']),
    ]),
    (value) => values.push(value),
    host,
  );
  state.key = 1;
  await flushUpdates();
  state.text = 'xy';
  await flushUpdates();
  state.key = 9;
  await flushUpdates();
  expect(values).toEqual(['a', 'b', 'y', undefined]);
  destroyComponent(host);
  state.text = '0123456789';
  await flushUpdates();
  expect(values).toEqual(['a', 'b', 'y', undefined]);
  expect((state as unknown as ViewModel)[VM_WATCHERS]?.size).toBe(0);
});

test('function roots retain ordinary name/length properties without reactive wrapping', () => {
  function render(first: unknown, second: unknown) {
    return [first, second];
  }
  expect(getValueByPath(render, ['name'])).toBe('render');
  expect(getValueByPath(render, ['length'])).toBe(2);
  expect(getValueByPath(render, ['missing'])).toBeUndefined();
});

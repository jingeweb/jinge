import {
  type ComponentHost,
  type Dict,
  type FC,
  type TOptions,
  ROOT_NODES,
  IntlWatcher,
  destroyComponent,
  intlGetLocale,
  intlInit,
  intlSetLocale,
  intlWatchLocale,
  renderIntlRichText,
  renderIntlText,
  renderIntlTextWithParams,
  t,
  textRenderFn,
  vm,
  watchForRender,
} from '../../src';
import {
  cleanupWith,
  createHost,
  deferred,
  flushUpdates,
  jestApi,
  setupRuntimeTests,
} from '../_helper';
setupRuntimeTests();
beforeEach(async () => {
  await intlInit({
    defaultLocale: 'unit_en',
    dicts: {
      unit_en: { greeting: 'Hello', count: (p: Record<string, unknown>) => `Count ${String(p.n)}` },
      unit_zh: { greeting: '你好', count: (p: Record<string, unknown>) => `数量 ${String(p.n)}` },
    },
  });
});
test('initialization selects a locale and translations fall back to text or key', () => {
  expect(intlGetLocale()).toBe('unit_en');
  expect(t('greeting')).toBe('Hello');
  expect(t('count', { n: 3 })).toBe('Count 3');
  expect(t('missing')).toBe('missing');
  // The compiler supplies the fallback string as the third argument at runtime.
  expect(t('missing', undefined, 'fallback' as unknown as TOptions)).toBe('fallback');
});
test('locale observers support immediate notification and cancellation', async () => {
  const callback = jestApi.fn();
  const cancel = cleanupWith(intlWatchLocale(callback, true));
  expect(callback).toHaveBeenCalledWith('unit_en');
  await intlSetLocale('unit_zh');
  await intlSetLocale('unit_zh');
  expect(callback).toHaveBeenCalledTimes(2);
  cancel();
  await intlSetLocale('unit_en');
  expect(callback).toHaveBeenCalledTimes(2);
});
test('locale loader is awaited and a loaded dictionary is cached', async () => {
  const task = deferred<Dict>();
  const loader = jestApi.fn(() => task.promise);
  await intlInit({ defaultLocale: 'unit_en', dictLoader: loader });
  const change = intlSetLocale('unit_async');
  task.resolve({ greeting: 'Async' });
  await change;
  expect(t('greeting')).toBe('Async');
  await intlSetLocale('unit_en');
  await intlSetLocale('unit_async');
  expect(loader).toHaveBeenCalledTimes(1);
});
test('text bindings react to locale changes and stop when destroyed', async () => {
  const host = createHost();
  const node = renderIntlText(host, true, 'greeting');
  document.body.append(node);
  expect(node.textContent).toBe('Hello');
  expect(host[ROOT_NODES]).toContain(node);
  await intlSetLocale('unit_zh');
  expect(node.textContent).toBe('你好');
  destroyComponent(host);
  await intlSetLocale('unit_en');
  expect(node.textContent).toBe('你好');
});
test('parameterized text reacts to both parameter and locale updates', async () => {
  const host = createHost();
  const params = vm({ n: 1 });
  const node = renderIntlTextWithParams(host, true, 'count', params);
  document.body.append(node);
  expect(node.textContent).toBe('Count 1');
  params.n = 2;
  await flushUpdates();
  expect(node.textContent).toBe('Count 2');
  await intlSetLocale('unit_zh');
  expect(node.textContent).toBe('数量 2');
});
test('missing text and parameterized text render supplied fallbacks', () => {
  const host = createHost();
  expect(renderIntlText(host, false, 'missing', 'default').textContent).toBe('default');
  expect(renderIntlText(host, false, 'unknown').textContent).toBe('unknown');
  expect(renderIntlTextWithParams(host, false, 'missing', { n: 1 }, 'default').textContent).toBe(
    'default',
  );
});
test('rich text bindings replace only their translated content between available dictionaries', async () => {
  const make =
    (text: string): FC =>
    (_: unknown, host: ComponentHost) => [textRenderFn(host, text)];
  await intlInit({
    defaultLocale: 'rich_en',
    dicts: { rich_en: { message: make('English') }, rich_zh: { message: make('中文') } },
  });
  const host = createHost();
  document.body.append(...(renderIntlRichText(host, true, 'message') as Node[]));
  await intlSetLocale('rich_zh');
  expect(document.body.textContent).toBe('中文');
  expect(host[ROOT_NODES]).toHaveLength(1);
});
test('IntlWatcher integrates locale changes with render bindings', async () => {
  const render = jestApi.fn();
  const host = createHost();
  watchForRender(IntlWatcher('count', { n: 5 }), render, host);
  expect(render).toHaveBeenLastCalledWith('Count 5');
  await intlSetLocale('unit_zh');
  expect(render).toHaveBeenLastCalledWith('数量 5');
  destroyComponent(host, false);
  await intlSetLocale('unit_en');
  expect(render).toHaveBeenCalledTimes(2);
});

test('initialization rejects a locale that has neither a dictionary nor a loader', async () => {
  await expect(intlInit({ defaultLocale: 'unit_missing_dictionary' })).rejects.toThrow(
    'not loaded',
  );
});
test('parameterized translation and rendered text fall back to the key without a default', () => {
  expect(t('missing-parameterized', { n: 1 })).toBe('missing-parameterized');
  expect(
    renderIntlTextWithParams(createHost(), false, 'missing-parameterized', { n: 1 }).textContent,
  ).toBe('missing-parameterized');
});
test('rich text can start with a fallback and replace it when another dictionary provides a component', async () => {
  const rich: FC = (_, h) => [textRenderFn(h, 'rich')];
  await intlInit({
    defaultLocale: 'unit_rich_missing',
    dicts: { unit_rich_missing: {}, unit_rich_available: { message: rich } },
  });
  const host = createHost();
  document.body.append(
    ...(renderIntlRichText(host, true, 'message', undefined, 'fallback') as Node[]),
  );
  expect(document.body.textContent).toBe('fallback');
  await intlSetLocale('unit_rich_available');
  expect(document.body.textContent).toBe('rich');
});

test('rich translation fallback preserves its parent and supports a later rich translation', async () => {
  const rich: FC = (_, h) => [textRenderFn(h, 'rich')];
  await intlInit({
    defaultLocale: 'unit_roundtrip_rich',
    dicts: { unit_roundtrip_rich: { message: rich }, unit_roundtrip_missing: {} },
  });
  const host = createHost();
  const sibling = document.createElement('aside');
  sibling.textContent = 'sibling';
  const nodes = renderIntlRichText(host, true, 'message', undefined, 'fallback') as Node[];
  host[ROOT_NODES].push(sibling);
  document.body.append(...nodes, sibling);
  await intlSetLocale('unit_roundtrip_missing');
  expect(sibling.isConnected).toBe(true);
  expect(document.body.textContent).toBe('fallbacksibling');
  await intlSetLocale('unit_roundtrip_rich');
  expect(document.body.textContent).toBe('richsibling');
});
test('a failed locale load restores the previous locale and can be retried', async () => {
  const loader = jestApi
    .fn<Promise<Dict>, [string]>()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ greeting: 'retried' });
  await intlInit({ defaultLocale: 'unit_en', dictLoader: loader });
  await expect(intlSetLocale('unit_retry_fixed')).rejects.toThrow('offline');
  expect(intlGetLocale()).toBe('unit_en');
  expect(t('greeting')).toBe('Hello');
  await intlSetLocale('unit_retry_fixed');
  expect(t('greeting')).toBe('retried');
  expect(loader).toHaveBeenCalledTimes(2);
});
test('a failed older locale request does not roll back a later successful switch', async () => {
  const task = deferred<Dict>();
  await intlInit({ defaultLocale: 'unit_en', dictLoader: () => task.promise });
  const pending = intlSetLocale('unit_older_failure');
  const assertion = expect(pending).rejects.toThrow('offline');
  await intlSetLocale('unit_zh');
  task.reject(new Error('offline'));
  await assertion;
  expect(intlGetLocale()).toBe('unit_zh');
});

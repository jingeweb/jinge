import {
  type ComponentHost,
  ROOT_NODES,
  bootstrap,
  intlInit,
  intlSetLocale,
  renderIntlRichText,
  textRenderFn,
} from '../../src';
import { setupRegressionTests, trackHost } from './_helper';

const jestApi = (import.meta as ImportMeta & { jest: typeof jest }).jest;

setupRegressionTests();

test('rich translation fallback should preserve the parent component', async () => {
  await intlInit({
    defaultLocale: 'en',
    dicts: { en: { rich: (_: any, h: ComponentHost) => [textRenderFn(h, 'rich text')] }, zh: {} },
  });
  function App(_: any, host: ComponentHost) {
    const div = document.createElement('div');
    div.append(...(renderIntlRichText(host, false, 'rich', undefined, 'fallback') as Node[]));
    const aside = document.createElement('aside');
    aside.textContent = 'sibling';
    host[ROOT_NODES].push(div, aside);
    return [div, aside];
  }
  trackHost(bootstrap(App, document.body));
  await intlSetLocale('zh');
  expect(document.querySelector('aside')?.textContent).toBe('sibling');
  expect(document.body.textContent).toContain('fallback');
});

test('failed locale loading should be retryable for the same locale', async () => {
  const loader = jestApi
    .fn<Promise<Record<string, never>>, [string]>()
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce({});
  await intlInit({ defaultLocale: 'review_base', dicts: { review_base: {} }, dictLoader: loader });
  await expect(intlSetLocale('review_retry')).rejects.toThrow('network');
  await intlSetLocale('review_retry');
  expect(loader).toHaveBeenCalledTimes(2);
});

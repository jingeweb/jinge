import { ComponentHost, NON_ROOT_COMPONENT_NODES, ROOT_NODES, addUnmountFn } from '../core';
import { type AnyFn, createEle, createFragment, createTextNode, insertBefore } from '../util';
import { isViewModel, vmWatch } from '../vm';

type Dict = Record<string, AnyFn>;
type DictStore = Record<string, Dict>;
type DictLoaderFn = (locale: string) => Promise<Dict>;
type OnChangeFn = (locale: string) => void;

let dictLoader: DictLoaderFn | undefined = undefined;
let currentLocale = '';
const dictStore: DictStore = {};
const watchers = new Set<OnChangeFn>();

export function watchLocale(onChange: OnChangeFn, immediate = false) {
  if (immediate) {
    onChange(currentLocale);
  }
  watchers.add(onChange);
  return () => watchers.delete(onChange);
}

export function getLocale() {
  return currentLocale;
}

export async function setLocale(locale: string) {
  if (currentLocale === locale) return;
  await changeLocale(locale);
  watchers.forEach((onChange) => onChange(locale));
}

async function changeLocale(locale: string) {
  currentLocale = locale;
  if (!dictStore[locale] && dictLoader) {
    dictStore[locale] = await dictLoader(locale);
  }
  if (!dictStore[locale]) throw new Error(`dict of ${locale} not loaded!`);
}

export async function initIntl(options: {
  defaultLocale: string;
  dicts?: DictStore;
  dictLoader?: DictLoaderFn;
}) {
  Object.assign(dictStore, options.dicts ?? {});
  dictLoader = options.dictLoader;

  await changeLocale(options.defaultLocale);
}

export interface TOptions {
  key: string;
}

export function t(
  defaultText: string,
  params?: Record<string, string | number | boolean>,
  options?: TOptions,
): string {
  // 编译器会把第一个参数替换为 key，转换时会结合第三个 options 参数计算 key。然后把第三个参数替换为 defaultText。
  return intlGetText(
    defaultText,
    params as unknown as Record<string, string | number | boolean>,
    options as unknown as string,
  );
}

export function intlGetText(
  key: string,
  params?: Record<string, string | number | boolean>,
  defaultText?: string,
) {
  const fn = dictStore[currentLocale]?.[key];
  return fn ? fn(params) : (defaultText ?? key);
}

export function renderIntlText(
  host: ComponentHost,
  pushRoot: boolean,
  key: string,
  params?: Record<string, string | number | boolean>,
  defaultText?: string,
) {
  const el = createTextNode('');

  isViewModel(params) &&
    addUnmountFn(
      host,
      vmWatch(params, (v) => {
        el.textContent = intlGetText(key, v, defaultText);
      }),
    );

  addUnmountFn(
    host,
    watchLocale(() => {
      el.textContent = intlGetText(key, params, defaultText);
    }, true),
  );

  pushRoot && host[ROOT_NODES].push(el);
  return el;
}

export function renderIntlRichText(
  host: ComponentHost,
  pushRoot: boolean,
  key: string,
  params?: Record<string, string | number | boolean>,
  defaultText?: string,
) {
  const el = new ComponentHost();
  const renderHtml = (p: typeof params) => {
    const html = intlGetText(key, p, defaultText);
    const tmp = createEle('div');
    tmp.innerHTML = html;
    const nodes = [...tmp.childNodes];
    const roots = el[ROOT_NODES];
    if (roots.length) {
      const lastEl = roots[0] as Node;
      const pa = lastEl.parentNode as Node;
      insertBefore(pa, nodes.length > 1 ? createFragment(nodes) : nodes[0]);
      roots.forEach((el) => pa.removeChild(el as Node));
      roots.length = 0;
    }
    roots.push(...nodes);
  };
  isViewModel(params) &&
    addUnmountFn(
      host,
      vmWatch(params, (v) => {
        renderHtml(v);
      }),
    );

  addUnmountFn(
    host,
    watchLocale(() => {
      renderHtml(params);
    }, true),
  );

  pushRoot ? host[ROOT_NODES].push(el) : host[NON_ROOT_COMPONENT_NODES].push(el);
  return el[ROOT_NODES];
}

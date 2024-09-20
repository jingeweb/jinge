import {
  CONTEXT,
  ComponentHost,
  NON_ROOT_COMPONENT_NODES,
  ROOT_NODES,
  addUnmountFn,
  renderFunctionComponent,
  replaceRenderFunctionComponent,
} from '../core';
import { type AnyFn, createTextNode, isFunction, isUndefined, throwErr } from '../util';
import { isViewModel, vmWatch } from '../vm';

type Dict = Record<string, string | AnyFn>;
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
  key?: string;
  isolate?: boolean;
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
  if (isUndefined(fn)) return defaultText ?? '';
  else if (isFunction(fn)) return fn(params) as string;
  else return fn as string;
}

export function renderIntlText(
  host: ComponentHost,
  pushRoot: boolean,
  key: string,
  params?: Record<string, string | number | boolean>,
  defaultText?: string,
) {
  const el = createTextNode('');

  if (isViewModel(params)) {
    addUnmountFn(
      host,
      vmWatch(params, (v) => {
        el.textContent = intlGetText(key, v, defaultText);
      }),
    );
  }

  addUnmountFn(
    host,
    watchLocale(() => {
      el.textContent = intlGetText(key, params, defaultText);
    }, true),
  );

  pushRoot && host[ROOT_NODES].push(el);
  return el;
}

export function renderIntlFc(
  host: ComponentHost,
  pushRoot: boolean,
  key: string,
  params?: Record<string, string | number | boolean>,
  defaultText?: string,
) {
  const Fc = dictStore[currentLocale]?.[key] as AnyFn;
  if (!Fc) {
    const el = createTextNode(defaultText ?? '');
    pushRoot && host[ROOT_NODES].push(el);
    return [el];
  }

  const el = new ComponentHost();
  if (pushRoot) host[ROOT_NODES].push(el);
  else host[NON_ROOT_COMPONENT_NODES].push(el);

  addUnmountFn(
    host,
    watchLocale(() => {
      const Fc = dictStore[currentLocale]?.[key] as AnyFn;
      if (!Fc) throwErr('intl-key-missing');
      replaceRenderFunctionComponent(el, Fc, host[CONTEXT], params);
    }),
  );
  return renderFunctionComponent(el, Fc, params);
}

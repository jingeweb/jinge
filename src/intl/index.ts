import {
  CONTEXT,
  ComponentHost,
  NON_ROOT_COMPONENT_NODES,
  ROOT_NODES,
  addUnmountFn,
  getFirstDOM,
  renderFunctionComponent,
  replaceRenderFunctionComponent,
  resetComponent,
} from '../core';
import type { FC, JNode } from '../jsx';
import { createTextNode, insertBefore } from '../util';
import { isViewModel, vmWatch } from '../vm';

type TFn = (params: Record<string, unknown>) => string;
type Dict = Record<string, string | TFn | FC>;
type DictStore = Record<string, Dict>;
type DictLoaderFn = (locale: string) => Promise<Dict>;
type OnChangeFn = (locale: string) => void;

let dictLoader: DictLoaderFn | undefined = undefined;
let currentLocale = '';
const dictStore: DictStore = {};
const watchers = new Set<OnChangeFn>();

export function intlWatchLocale(onChange: OnChangeFn, immediate = false) {
  if (immediate) {
    onChange(currentLocale);
  }
  watchers.add(onChange);
  return () => watchers.delete(onChange);
}

export function intlGetLocale() {
  return currentLocale;
}

export async function intlSetLocale(locale: string) {
  if (currentLocale === locale) return;
  await intlChangeLocale(locale);
  watchers.forEach((onChange) => onChange(locale));
}

async function intlChangeLocale(locale: string) {
  currentLocale = locale;
  if (!dictStore[locale] && dictLoader) {
    dictStore[locale] = await dictLoader(locale);
  }
  if (!dictStore[locale]) throw new Error(`dict of ${locale} not loaded!`);
}

export async function intlInit(options: {
  defaultLocale: string;
  dicts?: DictStore;
  dictLoader?: DictLoaderFn;
}) {
  Object.assign(dictStore, options.dicts ?? {});
  dictLoader = options.dictLoader;

  await intlChangeLocale(options.defaultLocale);
}

export interface TOptions {
  key: string;
}

export function t(
  defaultText: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Record<string, string | number | boolean | JNode | ((content: any) => JNode)>,
  options?: TOptions,
): string {
  // 编译器会把第一个参数替换为 key，转换时会结合第三个 options 参数计算 key。然后把第三个参数替换为 defaultText。
  if (params) {
    return (
      (dictStore[currentLocale]?.[defaultText] as TFn)?.(params) ??
      (options as unknown as string) ??
      defaultText
    );
  } else {
    return (
      (dictStore[currentLocale]?.[defaultText] as string) ??
      (options as unknown as string) ??
      defaultText
    );
  }
}

/**
 * 给模板编译器生成的代码使用的渲染函数。
 */
export function renderIntlText(
  host: ComponentHost,
  pushRoot: boolean,
  key: string,
  defaultText?: string,
) {
  const el = createTextNode('');

  addUnmountFn(
    host,
    intlWatchLocale(() => {
      el.textContent = (dictStore[currentLocale]?.[key] as unknown as string) ?? defaultText ?? key;
    }, true),
  );

  pushRoot && host[ROOT_NODES].push(el);
  return el;
}

/**
 * 给模板编译器生成的代码使用的渲染函数。
 */
export function renderIntlTextWithParams(
  host: ComponentHost,
  pushRoot: boolean,
  key: string,
  params: Record<string, unknown>,
  defaultText?: string,
) {
  const el = createTextNode('');
  const st = () => {
    const fn = dictStore[currentLocale]?.[key] as TFn;
    const tx = fn ? fn(params) : (defaultText ?? key);
    el.textContent = tx;
  };
  isViewModel(params) && addUnmountFn(host, vmWatch(params, st));
  addUnmountFn(host, intlWatchLocale(st));

  st();
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
  let Fc: FC | undefined = undefined;
  Fc = dictStore[currentLocale]?.[key] as FC;

  const update = () => {
    const preFc = Fc;
    Fc = dictStore[currentLocale]?.[key] as FC;
    if (Fc) {
      replaceRenderFunctionComponent(el, Fc, host[CONTEXT], params);
    } else if (preFc) {
      const tn = createTextNode(defaultText ?? key);
      const firstEl = getFirstDOM(el);
      const $parent = firstEl.parentNode as Node;
      insertBefore($parent, tn, firstEl);
      resetComponent(host, host[CONTEXT]);
      host[ROOT_NODES].push(tn);
    }
  };

  addUnmountFn(
    host,
    intlWatchLocale(() => {
      update();
    }),
  );

  pushRoot ? host[ROOT_NODES].push(el) : host[NON_ROOT_COMPONENT_NODES].push(el);

  if (!Fc) {
    const tn = createTextNode(defaultText ?? key);
    el[ROOT_NODES].push(tn);
    return el[ROOT_NODES];
  } else {
    return renderFunctionComponent(el, Fc, params);
  }
}

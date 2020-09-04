import {
  isString,
  uid,
  isFunction,
  DeregisterFn
} from '../util';
import {
  Messenger
} from './messenger';

type FetchFn = (locale: string) => Promise<string>;
type StringOrFetchFn = string | FetchFn;
type RenderTextFn = (ctx?: Record<string, unknown>) => string;
type RenderFactory = (...deps: unknown[]) => RenderDicts;
type RenderFn = (...args: unknown[]) => Node[];
type RenderDict = {
  [k: string]: string | RenderFn;
}
type RenderDicts = {
  components: RenderDict;
  attributes: RenderDict;
}
type Locale = {
  locale: string;
  dictionary?: {
    [k: string]: string | RenderTextFn;
  };
  render?: RenderDicts | RenderFactory;
  __renders?: RenderFactory[];
}

declare global {
  interface Window {
    JINGE_I18N_DATA: Locale;
  }
}


const TextFnCache = new Map<string, RenderTextFn>();
/**
 * convert i18n text template to function
 * @param {String} text i18n formatted text template
 */
export function compile(text: string): RenderTextFn {
  let fn = TextFnCache.get(text);
  if (!fn) {
    fn = new Function('__ctx', `return \`${text.replace(/`/g, '\\`').replace(/\$\{\s*([\w\d._$]+)\s*\}/g, (m, n) => {
      return '${ __ctx.' + n + ' }';
    })}\`;`) as RenderTextFn;
    TextFnCache.set(text, fn);
  }
  return fn;
}

function defaultFetchFn(url: string): Promise<string> {
  return window.fetch(url).then(res => res.text());
}


function mergeDictOrRender(main: Record<string, unknown>, chunk: Record<string, unknown>): void {
  for(const k in chunk) {
    if (!(k in main)) {
      main[k] = chunk[k];
    }
  }
}

function _assert(s: I18nService): void {
  if (!s.__data) throw new Error('i18n data not found. Forgot to load i18n resource script?');
}

/**
 * @interval
 */
export interface I18NChunkLoader {
  /**
   * @internal
   */
  _get(locale: string): string;
  /**
   * @internal
   */
  _load(locale: string): Promise<void>;
}

class I18nService extends Messenger {
  __deps: unknown[];
  __data: Locale;
  __cache: Map<string, Locale>;
  __loader: I18NChunkLoader;
  __key: string;
  __activeChunks: string[];
  __loadedChunks: {
    [chunkName: string]: string[];
  }[];

  constructor() {
    super();
    this.__deps = null;
    this.__data = null;
    this.__cache = new Map();
    this.__key = null;
    this.__loader = null;

    const d = window.JINGE_I18N_DATA;
    d && this.__regLoc(d);
  }

  get locale(): string {
    _assert(this);
    return this.__data.locale;
  }

  /**
   * Register i18n render depedent.
   * This method will be called by compiler generated code, don't call it manully.
   */
  __regDep(idx: number, depent: unknown): void {
    const deps = this.__deps || (this.__deps = []);
    if (deps[idx]) {
      if (deps[idx] !== depent) throw new Error(`conflict at ${idx}`);
      return;
    }
    deps[idx] = depent;
  }

  /**
   * Register locale data, will be called in locale resource script.
   * Usually you don't need call this method manully.
   */
  __regLoc(data: Locale): void {
    const cache = this.__cache;
    if (!cache.has(data.locale)) {
      cache.set(data.locale, {
        locale: data.locale,
        dictionary: null,
        render: { components: {}, attributes: {} },
        __renders: []
      });
    }
    const localeData: Locale = cache.get(data.locale);
    if (isFunction(data.render)) {
      localeData.__renders.push(data.render as RenderFactory);
    }
    if (data.dictionary) {
      if (!localeData.dictionary) localeData.dictionary = data.dictionary;
      else mergeDictOrRender(localeData.dictionary, data.dictionary);
    }
    if (!this.__data) {
      this.__data = localeData;
    }
  }

  /**
   * switch to another locale/language
   * @param locale 目标语言
   * @param filenameOrLoadFn 目标语言的资源包文件路径。如果为 chunk 服务指定了 meta 信息，则该参数可忽略，自动从 meta 信息里取。
   */
  async switch(locale: string, filenameOrLoadFn?: StringOrFetchFn): Promise<void> {
    if (this.__data.locale === locale) {
      return;
    }
    if (!filenameOrLoadFn) {
      filenameOrLoadFn = this.__loader?._get(locale);
      if (!filenameOrLoadFn) throw new Error('filename required.');
    }
    const key = uid();
    this.__key = key;
    this.__notify('before-change', this.locale, locale);
    let data = this.__cache.get(locale);
    if (!data) {
      const code = await (
        isString(filenameOrLoadFn) 
        ? defaultFetchFn(filenameOrLoadFn as string)
        : (filenameOrLoadFn as FetchFn)(locale)
      ); 
      (new Function('jinge', code))({
        i18n: this
      });
      if (this.__key !== key) {
        /*
          * ignore if callback has been expired.
          * 使用闭包的技巧来检测当前回调是否已经过期，
          */
        return;
      }
      data = this.__cache.get(locale);
    }
    this.__data = data;
    if (this.__loader) {
      await this.__loader._load(locale);
      if (this.__key !== key) {
        return;
      }
    }
    
    this.__notify('change', this.locale);
  }

  __t(key: string, params?: Record<string, unknown>): string {
    _assert(this);
    const dict = this.__data.dictionary;
    if (!(key in dict)) {
      return 'i18n_missing';
    }
    let text = dict[key];
    if (isString(text)) {
      // text.startsWith("«") means reference to another key
      if ((text as string).charCodeAt(0) === 171) {
        text = dict[(text as string).substring(1)];
        if (isString(text)) {
          text = compile(text as string);
        }
      } else {
        text = compile(text as string);
      }
      dict[key] = text;
    }
    return (text as RenderTextFn)(params);
  }

  __r(key: string, type: keyof RenderDicts): RenderFn {
    _assert(this);
    const __renders = this.__data.__renders;
    const render = this.__data.render as RenderDicts;
    if (__renders && __renders.length > 0) {
      if (!this.__deps) throw new Error('missing deps');
      __renders.forEach(renderFactory => {
        const r = renderFactory(...this.__deps);
        mergeDictOrRender(render.components, r.components);
        mergeDictOrRender(render.attributes, r.attributes);
      });
      __renders.length = 0;
    }
    const renderDict = render[type];
    if (!(key in renderDict)) {
      throw new Error(`missing ${type} key: ${key}`);
    }
    let fn = renderDict[key];
    if (isString(fn)) {
      // if fn is string, it's a reference to another key.
      renderDict[key] = fn = renderDict[fn as string];
    }
    return fn as RenderFn;
  }

  /**
   * @param handler a listener bind to change event
   * @param immediate call listener immediately, default is false.
   * @returns a function auto remove listener
   */
  watch(listener: (locale: string) => void, immediate = false): DeregisterFn {
    this.__on('change', listener);
    if (immediate) {
      listener(this.locale);
    }
    return (): void => {
      this.__off('change', listener);
    };
  }
}


/* Singleton */
export const i18n = new I18nService();

/**
 * Compiler helper function, the first parameter will be convert to i18n dictionary key,
 * and the whole function will be transform to `i18nService._t(key, params)`
 *
 * But after i18n locale resource script had been written, compiler won't transform it,
 * the function will work as text parse util.
 *
 * @param {String|Object} text
 * @param {Object} params
 */
export function _t(text: string, params?: Record<string, unknown>): string {
  return params ? compile(text)(params) : text;
}

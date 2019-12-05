import {
  Symbol,
  isString,
  uid,
  isFunction,
  getOrCreateArrayProperty
} from '../util';
import {
  Messenger,
  NOTIFY,
  ON,
  OFF
} from './messenger';

export const I18N_GET_COMPONENT_RENDER = Symbol('fn_get_component_render');
export const I18N_GET_ATTRIBUTE_RENDER = Symbol('fn_get_attribute_render');
export const I18N_GET_TEXT = Symbol('fn_get_text');
export const I18N_LOCALE_CHANGE = Symbol('locale_change');
export const I18N_REG_DEP = Symbol('fn_register_render_dependent');
export const I18N_CURRENT_LOCALE = Symbol('current_locale');

const RENDER_DEPS = Symbol('render_dependents');
const LAST_FETCHING_KEY = Symbol('last_fetching_key');
const CURRENT_DATA = Symbol('current_data');
const CACHE = Symbol('cache');
const DEFAULT_FILENAME = 'dist/locale.[locale].js';

/**
 * convert i18n text template to function
 * @param {String} text i18n formatted text template
 */
function compile(text) {
  // eslint-disable-next-line no-new-func
  return new Function('__ctx', `return \`${text.replace(/`/g, '\\`').replace(/\$\{\s*([\w\d._$]+)\s*\}/g, (m, n) => {
    return '${ __ctx.' + n + ' }';
  })}\`;`);
}

function defaultFetchFn(locale, filename) {
  return window.fetch(filename.replace('[locale]', locale)).then(res => res.text());
}

class I18nService extends Messenger {
  constructor(attrs) {
    super(attrs);
    this[RENDER_DEPS] = null;
    this[CURRENT_DATA] = null;
    this[CACHE] = new Map();
    this[LAST_FETCHING_KEY] = null;

    this.r(window.JINGE_I18N_DATA);
  }

  parse(template, params) {
    return compile(template)(params);
  }

  get locale() {
    return this[CURRENT_DATA].locale;
  }

  /**
   * Register i18n render depedent.
   * This method will be called by compiler generated code, don't call it manully.
   */
  [I18N_REG_DEP](idx, depent) {
    const deps = getOrCreateArrayProperty(this, RENDER_DEPS);
    if (deps[idx]) throw new Error(`conflict at ${idx}`);
    deps[idx] = depent;
  }

  /**
   * Register locale data, will be called in locale resource script.
   * Usually you don't need call this method manully.
   */
  r(data) {
    if (!data || this[CACHE].has(data.locale)) {
      return;
    }
    this[CACHE].set(data.locale, data);
    if (!this[CURRENT_DATA]) {
      this[CURRENT_DATA] = data;
    }
  }

  /**
   * switch to another locale/language
   * @param {String} locale locale to swtiched
   * @param {String|Function} filename filename of locale script with full path, or function fetch locale script.
   */
  switch(locale, filename = DEFAULT_FILENAME) {
    if (this[CURRENT_DATA].locale === locale) {
      return;
    }
    const data = this[CACHE].get(locale);
    if (!data) {
      const key = uid();
      this[LAST_FETCHING_KEY] = key;
      (isFunction(filename) ? filename(locale) : defaultFetchFn(locale, filename)).then(code => {
        // eslint-disable-next-line no-new-func
        (new Function('jinge', code))({
          i18n: this
        });
        if (this[LAST_FETCHING_KEY] !== key || this[CURRENT_DATA].locale === locale) {
          /*
            * ignore if callback has been expired.
            * 使用闭包的技巧来检测当前回调是否已经过期，
            * 即，是否已经有新的 fetchFn 函数的调用。
            */
          return;
        }
        const data = this[CACHE].get(locale);
        this[CURRENT_DATA] = data;
        this[NOTIFY](I18N_LOCALE_CHANGE, this.locale);
      });
    } else {
      this[CURRENT_DATA] = data;
      this[NOTIFY](I18N_LOCALE_CHANGE, this.locale);
    }
  }

  [I18N_GET_TEXT](key, params) {
    const dict = this[CURRENT_DATA].dictionary;
    if (!(key in dict)) {
      return 'i18n_missing';
    }
    let text = dict[key];
    if (isString(text)) {
      // text.startsWith("«") means reference to another key
      if (text.charCodeAt(0) === 171) {
        text = dict[text.substring(1)];
        if (isString(text)) {
          text = compile(text);
        }
      } else {
        text = compile(text);
      }
      dict[key] = text;
    }
    return text(params);
  }

  [I18N_GET_COMPONENT_RENDER](key) {
    return getRender(this, 'components', key);
  }

  [I18N_GET_ATTRIBUTE_RENDER](key) {
    return getRender(this, 'attributes', key);
  }

  /**
   * Bind listener to LOCALE_CHANGE event,
   * return a function auto remove this listener
   * @param {Function} handler a listener bind to LOCALE_CHANGE event
   * @param {Boolean} immediate call listener immediately, default is false.
   * @returns {Function} a function auto remove listener
   */
  watch(listener, immediate) {
    this[ON](I18N_LOCALE_CHANGE, listener);
    if (immediate) listener(this.locale);
    return () => {
      this[OFF](I18N_LOCALE_CHANGE, listener);
    };
  }
}

function getRender(m, type, key) {
  const data = m[CURRENT_DATA];
  const depFns = m[RENDER_DEPS];
  if (isFunction(data.render)) {
    if (!depFns) {
      throw new Error('missing I18N_RENDER_DEPS');
    }
    data.render = data.render(...depFns);
  }
  const renders = data.render[type];
  if (!(key in renders)) {
    throw new Error(`missing i18n ${type} for key: ${key}`);
  }
  let fn = renders[key];
  if (isString(fn)) {
    // if fn is string, it's a reference to another key.
    renders[key] = fn = renders[fn];
  }
  return fn;
}

/* Singleton */
export const i18n = new I18nService();

/**
 * Compiler helper function, the first parameter will be convert to i18n dictionary key,
 * and the whole function will be transform to `i18nService[GET_TEXT](key, params)`
 *
 * But after i18n locale resource script had been written, compiler won't transform it,
 * the function will work as text parse util.
 *
 * @param {String|Object} text
 * @param {Object} params
 */
export function _t(text, params) {
  return params ? compile(text)(params) : text;
}

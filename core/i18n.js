import {
  isObject,
  Symbol
} from '../util';
import {
  config,
  CFG_I18N_WARN_KEY_NOT_FOUND
} from '../config';
import {
  Messenger,
  NOTIFY
} from './messenger';

export const messenger = new Messenger();
export const I18N_DATA_CHANGED = Symbol('data-changed');

let dictStore = window.JINGE_I18N_DATA || null;

export function _t(text, params) {
  if (!params || !isObject(params) || text.indexOf('{') < 0) {
    return text;
  }
  return text.replace(/\$\{\s*([\w\d._$]+)\s*\}/g, function(m, n) {
    // 因为支持 ${ a.b.c } 这样的写法，所以直接构造 eval 函数获取。
    if (n.indexOf('.') >= 0) {
      /* eslint no-new-func: "off" */
      return (new Function(`return obj.${n}`, 'obj'))(params);
    } else {
      return params[n];
    }
  });
}

export function i18n(key, params) {
  if (!dictStore || !(key in dictStore)) {
    if (config[CFG_I18N_WARN_KEY_NOT_FOUND]) {
      console.error('Warning: i18n key', key, 'not found.');
    }
    return key;
  }
  return _t(dictStore[key], params);
}

export function prefix(prefix) {
  return function(key, params) {
    return i18n(prefix + '.' + key, params);
  };
}

export function registerData(dict) {
  if (window.JINGE_I18N_DATA) {
    /**
     * 当 window.JINGE_I18N_DATA 存在的情况下，可以不用主动调用
     *   registerI18nData 就能直接使用 i18n 函数来取多语言文本。
     *   这种使用方式下， i18n 函数可以在代码文件的任意位置书写，
     *   包括书写在文件的最顶部。
     *   但是，书写在文件最顶部的 i18n 代码，都几乎只是用于将多语言
     *   文本赋予一个常量，然后在其它地方使用。
     *   我们认为，这种使用方式下，不应该再使用 registerI18nData 来覆盖
     *   字典数据（从而实现不重新加载 app 的情况下，热更新界面的多语言文本展示）。
     *
     * 如果想要通过 registerI18nData 来覆盖字典数据实现热更新，则 i18n 函数
     *   不应该在文件顶部书写。原因在于，文件顶部的代码，在整个 bundle 加载时就已经被
     *   执行了，这时候 bootstrap 函数和 registerI18nData 函数是否已经执行
     *   很难确定（因为各文件的顶部代码的执行顺序取决于文件之间的依赖关系，即打包
     *   后在 bundle 里的次序）。
     *
     * 对于 window.JINGE_I18N_DATA 已经存在的情况下，仍然试图热更新的行为，
     *   我们给予告警提示，帮助用户尽量避免踩坑。
     */
    console.error('Warning: try change i18n dictionary data when window.JINGE_I18N_DATA is set. see https://todo');
  }
  const hasOld = !!dictStore;
  dictStore = dict;
  if (hasOld) {
    messenger[NOTIFY](I18N_DATA_CHANGED);
  }
}

import {
  isObject
} from '../util';
import {
  config,
  CFG_I18N_WARN_KEY_NOT_FOUND
} from '../config';

let dictStore = window.JingeI18nData || null;

export function i18n(key, params) {
  if (!dictStore || !(key in dictStore)) {
    if (config[CFG_I18N_WARN_KEY_NOT_FOUND]) {
      console.error('Warning: i18n key', key, 'not found.');
    }
    return key;
  }
  const message = dictStore[key];
  if (!params || !isObject(params) || message.indexOf('{') < 0) {
    return message;
  }
  return message.replace(/\{\s*([\w\d._$]+)\s*\}/g, function(m, n) {
    // 因为支持 { a.b.c } 这样的写法，所以直接构造 eval 函数获取。
    if (n.indexOf('.') >= 0) {
      return (new Function(`return obj.${n}`, 'obj'))(params);        
    } else {
      return params[n];
    }
  });
}

export function prefix(prefix) {
  return function(key, params) {
    return i18n(prefix + '.' + key, params);
  };
}

export function registerData(dict) {
  dictStore = dict;
}

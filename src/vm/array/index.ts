import { type AnyFn, isString } from '../../util';
import { VM_RAW, type ViewModelArray } from '../core';
import { propSetHandler } from '../proxy';
import { arraySetLength } from './length';
import { arrayPop } from './pop';
import { arrayPush } from './push';
import { arrayShift } from './shift';

/**
 * 即便是 arr[0] 这样的取值，在 Proxy 的 set 里面，传递的 property 也是 string 类型，即 "0"，转换为 int 后取值。
 */
function wrapProp(prop: string | symbol) {
  return isString(prop) && /^\d+$/.test(prop) ? parseInt(prop) : prop;
}
function wrapFn(target: unknown, fn: AnyFn) {
  return function (...args: unknown[]) {
    return fn(target, ...args);
  };
}
export const ArrayProxyHandler: ProxyHandler<ViewModelArray> = {
  get(target, prop): unknown {
    switch (prop) {
      case 'push':
        return wrapFn(target, arrayPush);
      case 'pop':
        return wrapFn(target, arrayPop);
      case 'shift':
        return wrapFn(target, arrayShift);
      default: {
        const index = wrapProp(prop);
        return target[index as number] ?? target[VM_RAW][index as number];
      }
    }
  },
  set(target, prop, value) {
    if (prop === 'length') {
      arraySetLength(target, value);
      return true;
    }

    return propSetHandler(target, wrapProp(prop), value);
  },
};

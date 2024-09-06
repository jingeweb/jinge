import { type AnyFn, isObject, isString, isSymbol } from 'src/util';
import {
  GlobalViewModelWeakMap,
  type PropertyPathItem,
  VM_PARENTS,
  VM_RAW,
  VM_WATCHERS,
  type ViewModel,
} from '../core';
import type { Watcher } from '../watch';
import { arrayPush } from './push';
import { propSetHandler } from '../object';
import { wrapPropChildViewModel } from '../proxy';

/**
 * 即便是 arr[0] 这样的取值，在 Proxy 的 set 里面，传递的 property 也是 string 类型，即 "0"，转换为 int 后取值。
 */
function wrapProp(prop: string | symbol) {
  return isString(prop) && /^\d+$/.test(prop) ? parseInt(prop) : prop;
}
function wrapFn(targetViewModel: ViewModel, target: unknown, fn: AnyFn) {
  return function (...args: unknown[]) {
    return fn(targetViewModel, target, ...args);
  };
}

function ArrayProxyHandler(): ProxyHandler<unknown[] & ViewModel> {
  let watchers: Set<Watcher>;
  let parents: Map<PropertyPathItem, Set<ViewModel>>;
  return {
    get(target, prop, receiver) {
      if (prop === VM_RAW) return target;
      else if (prop === VM_PARENTS) {
        return parents;
      } else if (prop === VM_WATCHERS) {
        return watchers;
      } else if (isSymbol(prop)) {
        return target[prop];
      } else if (prop === 'push') {
        return wrapFn(receiver, target, arrayPush);
      } else {
        const index = wrapProp(prop);
        const val = target[index];
        if (!isObject(val)) return val;
        const vm = GlobalViewModelWeakMap.get(val);
        return vm ?? val;
      }
    },
    set(target, prop, newValue, receiver) {
      if (prop === VM_WATCHERS) {
        watchers = newValue;
      } else if (prop === VM_PARENTS) {
        parents = newValue;
      } else {
        propSetHandler(receiver, target, wrapProp(prop), newValue);
      }
      return true;
    },
  };
}

export function wrapViewModelArr(target: unknown[]) {
  const viewModel = new Proxy(target, ArrayProxyHandler()) as unknown as ViewModel;
  GlobalViewModelWeakMap.set(target, viewModel);
  for (let i = 0; i < target.length; i++) {
    wrapPropChildViewModel(viewModel, target[i], i);
  }
  return viewModel;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AnyObj } from '../util';
import { isObject, isSymbol } from '../util';

import type { PropertyPathItem, ViewModel, ViewModelRaw } from './core';
import {
  ONLY_DEV_TARGET,
  VM_IGNORED,
  VM_PROXY,
  VM_RAW,
  addParent,
  isInnerObj,
  removeParent,
} from './core';
import { wrapPropChildViewModel, wrapViewModel } from './proxy';
import { notifyVmPropChange } from './watch';

export function propSetHandler(target: ViewModel, prop: PropertyPathItem, value: unknown) {
  if (isObject(value)) {
    let valueViewModel = value[VM_PROXY];
    if (valueViewModel) {
      // 如果新的数据已经是 ViewModel，则需要把新数据的 VM_RAW 原始数据赋予到 target[VM_RAW][prop] 上。
      if (isSymbol(prop)) {
        // symbol 属性直接赋值且不需要通知变更。
        target[VM_RAW][prop] = valueViewModel[VM_RAW];
      } else {
        const oldViewModel = (target as AnyObj)[prop] as ViewModel;
        if (oldViewModel === valueViewModel) {
          // 前后 object 的 ViewModel 都没变，直接退出。
          return true;
        }
        oldViewModel && removeParent(oldViewModel, target, prop);
        (target as AnyObj)[prop] = valueViewModel;
        target[VM_RAW][prop] = valueViewModel[VM_RAW];
        addParent(valueViewModel, target, prop);
        notifyVmPropChange(target, prop);
      }
    } else {
      if (isSymbol(prop)) {
        target[VM_RAW][prop] = value;
        return true;
      }
      if (!isInnerObj(value) && !value[VM_IGNORED]) {
        // 如果新的数据不是 ViewModel，则需要转换成 ViewModel
        valueViewModel = wrapViewModel(value);
        const oldViewModel = (target as AnyObj)[prop] as ViewModel;
        if (oldViewModel) removeParent(oldViewModel, target, prop);
        (target as AnyObj)[prop] = valueViewModel;
        target[VM_RAW][prop] = value;
        addParent(valueViewModel, target, prop);
        notifyVmPropChange(target, prop);
      } else {
        // 新的数据是不需要转 ViewModel 的 object，比如 Boolean 等，则直接赋值。
        const oldViewModel = (target as AnyObj)[prop] as ViewModel;
        if (oldViewModel) removeParent(oldViewModel, target, prop);
        const oldVal = oldViewModel ?? target[VM_RAW][prop];
        // 如果新旧数据完全相同，则不需要做任何响应。
        if (oldVal !== value) {
          target[VM_RAW][prop] = value;
          notifyVmPropChange(target, prop);
        }
      }
    }
  } else {
    if (isSymbol(prop)) {
      // 如果 prop 是 symbol，value 又不是 object（也就不可能是 ViewModel）, 则直接赋值到原始数据上。
      target[VM_RAW][prop] = value;
      return true;
    }
    const oldViewModel = (target as AnyObj)[prop] as ViewModel;
    if (oldViewModel) {
      // value 不是 object 就不可能是 viewmodel，老的 viewmodel 一定需要卸载。
      (target as AnyObj)[prop] = undefined;
      removeParent(oldViewModel, target, prop);
    }
    const oldVal = oldViewModel ?? target[VM_RAW][prop];
    // 如果新旧数据完全相同，则不需要做任何响应。
    if (oldVal !== value) {
      target[VM_RAW][prop] = value;
      notifyVmPropChange(target, prop);
    }
  }

  return true;
}

const ObjectProxyHandler: ProxyHandler<any> = {
  get(target, prop) {
    return target[prop] ?? target[VM_RAW][prop];
  },
  set: propSetHandler,
};

export function wrapViewModelObj(target: ViewModelRaw) {
  const viewModel: ViewModel = {
    [VM_RAW]: target,
    [VM_PROXY]: undefined as any,
  };
  // BEGIN_DROP_IN_PRODUCTION
  viewModel[ONLY_DEV_TARGET] = viewModel;
  // END_DROP_IN_PRODUCTION
  const proxy = new Proxy(viewModel, ObjectProxyHandler);
  viewModel[VM_PROXY] = target[VM_PROXY] = proxy;
  for (const k in target) {
    wrapPropChildViewModel(viewModel, target[k], k);
  }
  return proxy;
}

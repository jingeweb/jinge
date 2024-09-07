/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AnyObj } from '../util';
import { isObject, isSymbol } from '../util';

import type { PropertyPathItem, ViewModel } from './core';
import {
  GlobalViewModelWeakMap,
  VM_PARENTS,
  VM_RAW,
  VM_WATCHERS,
  addParent,
  removeParent,
  shouldBeVm,
} from './core';
import { wrapPropChildViewModel, wrapViewModel } from './proxy';
import { type Watcher, notifyVmPropChange } from './watch';

export function getVmAndRaw(value: unknown): [ViewModel | undefined, unknown] {
  if (!isObject(value)) return [undefined, value];
  const rawValue = value[VM_RAW];
  if (rawValue) return [value as ViewModel, rawValue];
  const vm = GlobalViewModelWeakMap.get(value);
  return [vm, vm ? vm[VM_RAW] : value];
}

export function propSetHandler(
  targetViewModel: ViewModel,
  target: AnyObj,
  prop: PropertyPathItem,
  value: unknown,
) {
  const [valueVm, rawValue] = getVmAndRaw(value as ViewModel);
  if (valueVm) {
    // 如果新的数据已经是 ViewModel，则需要把新数据的 VM_RAW 原始数据赋予到 target[prop] 上。
    if (isSymbol(prop)) {
      // symbol 属性直接赋值且不需要通知变更。
      target[prop] = rawValue;
    } else {
      const [oldValueVm, oldRawValue] = getVmAndRaw(target[prop]);
      if (oldValueVm === valueVm || oldRawValue === rawValue) {
        // 前后都没变，直接退出。
        return;
      }
      oldValueVm && removeParent(oldValueVm, targetViewModel, prop);
      target[prop] = rawValue;
      addParent(valueVm, targetViewModel, prop);
      notifyVmPropChange(targetViewModel, prop);
    }
    return; // important!
  }

  if (isSymbol(prop)) {
    // symbol 属性直接赋值且不需要通知变更。symbol 属性的旧值也不可能是 ViewModel,不需要 removeParent
    target[prop] = value;
    return; // important!
  }

  const [oldValueVm, oldRawValue] = getVmAndRaw(target[prop]);
  oldValueVm && removeParent(oldValueVm, targetViewModel, prop);
  if (oldRawValue === value) {
    // 前后数据都没有发生变化,直接退出更新逻辑
    return; // important!
  }
  if (shouldBeVm(value)) {
    // value 是需要转 ViewModel 的类型,则转成 ViewModel
    const newValueVm = wrapViewModel(value);
    addParent(newValueVm, targetViewModel, prop);
  }
  target[prop] = value;
  notifyVmPropChange(targetViewModel, prop);
}

function ObjectProxyHandler(): ProxyHandler<any> {
  let watchers: Set<Watcher>;
  let parents: Map<PropertyPathItem, Set<ViewModel>>;
  return {
    get(target, prop) {
      if (prop === VM_RAW) return target;
      else if (prop === VM_PARENTS) {
        return parents;
      } else if (prop === VM_WATCHERS) {
        return watchers;
      } else if (isSymbol(prop)) {
        return target[prop];
      } else {
        const val = target[prop];
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
        propSetHandler(receiver, target, prop, newValue);
      }
      return true;
    },
  };
}

export function wrapViewModelObj(target: AnyObj) {
  const viewModel = new Proxy(target, ObjectProxyHandler());
  GlobalViewModelWeakMap.set(target, viewModel);
  for (const k in target) {
    wrapPropChildViewModel(viewModel, target[k], k);
  }
  return viewModel;
}

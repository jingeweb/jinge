import { isArray, isObject } from '../util';
import { wrapViewModelArr } from './array';

import type { ViewModel, ViewModelIgnore, ViewModelRaw } from './core';
import {
  // END_DROP_IN_PRODUCTION
  VM_IGNORED,
  VM_PROXY,
  VM_RAW,
  addParent,
  mayBeVm,
} from './core';
import { wrapViewModelObj } from './object';

export function wrapPropChildViewModel(parent: ViewModel, child: unknown, prop: string | number) {
  if (!mayBeVm(child)) {
    return;
  }
  let viewModel = child[VM_PROXY];
  if (!viewModel) viewModel = wrapViewModel(child);
  parent[prop] = viewModel;
  addParent(viewModel, parent, prop);
}

export function wrapViewModel(target: ViewModelRaw | ViewModelRaw<ViewModelRaw[]>) {
  return isArray(target) ? wrapViewModelArr(target) : wrapViewModelObj(target);
}

/**
 * 将给定的 target 对象进行 ViewModel 包裹，返回 Proxy。后续可对 ViewModel 进行 watch 监听变更。
 * 该绑定为深度递归绑定，属性值如果是 object/array 也会进行递归包裹。
 *
 * 对于同一个 target 对象，多次调用 vm() 返回拿到的是同一个 ViewModel。比如：
 * ```ts
 * import { vm } from 'jinge';
 * const someData = { a: 10 };
 * const v1 = vm(someData);
 * const v2 = vm(someData);
 * console.log(v1 === v2, v1 === someData); // true, false
 * ```
 *
 * 需要注意的是，如果 target 对象的属性 key 是 Symbol，则不会进行包裹。赋值时同理。
 */
export function vm<T extends object>(target: T): T {
  return mayBeVm(target) ? (target[VM_PROXY] ?? wrapViewModel(target)) : target;
}

/**
 * 拿到目标 ViewModel 上的原始数据。目标 ViewModel 是深度递归包裹的 Proxy 树，拿到其原始数据。
 */
export function vmRaw<T extends object>(target: T): T {
  if (!isObject(target)) return target;
  return (target as ViewModel)[VM_RAW] ?? target;
}
/**
 * 标记目标对象数据为 vm ignored。被忽略后的数据，在赋予到其它 ViewModel 属性上时，不会被转换成 ViewModel
 */
export function vmIgnore<T extends object>(target: T) {
  isObject<ViewModelIgnore>(target) && (target[VM_IGNORED] = true);
}

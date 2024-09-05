/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AnyObj } from '../util';
import { isArray, isObject, isSymbol } from '../util';
import { ArrayProxyHandler } from './array';

import type {
  PropertyPathItem,
  ViewModel,
  ViewModelArray,
  ViewModelIgnore,
  ViewModelRaw,
} from './core';
import { VM_IGNORED, VM_PROXY, VM_RAW, addParent, isInnerObj, mayBeVm, removeParent } from './core';
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
        valueViewModel = wrapObj(value);
        const oldViewModel = (target as AnyObj)[prop] as ViewModel;
        oldViewModel && removeParent(oldViewModel, target, prop);
        (target as AnyObj)[prop] = valueViewModel;
        target[VM_RAW][prop] = value;
        addParent(valueViewModel, target, prop);
        notifyVmPropChange(target, prop);
      } else {
        // 新的数据是不需要转 ViewModel 的 object，比如 Boolean 等，则直接赋值。
        const oldViewModel = (target as AnyObj)[prop] as ViewModel;
        oldViewModel && removeParent(oldViewModel, target, prop);
        const oldVal = oldViewModel ?? target[VM_RAW][prop];
        if (oldVal !== value) {
          target[VM_RAW][prop] = value;
          notifyVmPropChange(target, prop);
        } else {
          // 如果新旧数据完全相同，则不需要做任何响应。
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
    if (oldVal !== value) {
      target[VM_RAW][prop] = value;
      notifyVmPropChange(target, prop);
    } else {
      // 如果新旧数据完全相同，则不需要做任何响应。
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

function wrapProp(parent: ViewModel, child: unknown, prop: string | number) {
  if (!mayBeVm(child)) {
    return;
  }
  let viewModel = child[VM_PROXY];
  if (!viewModel) viewModel = wrapObj(child);
  parent[prop] = viewModel;
  addParent(viewModel, parent, prop);
}

export function wrapObj(target: ViewModelRaw | ViewModelRaw[]) {
  if (isArray(target)) {
    const viewModel = [] as unknown as ViewModelArray;
    viewModel[VM_RAW] = target as any;
    const proxy = new Proxy(viewModel, ArrayProxyHandler);
    viewModel[VM_PROXY] = (target as unknown as ViewModelRaw)[VM_PROXY] = proxy;
    for (let i = 0; i < target.length; i++) {
      wrapProp(viewModel, target[i], i);
    }
    return proxy;
  } else {
    const viewModel: ViewModel = {
      [VM_RAW]: target,
      [VM_PROXY]: undefined as any,
    };
    const proxy = new Proxy(viewModel, ObjectProxyHandler);
    viewModel[VM_PROXY] = target[VM_PROXY] = proxy;
    for (const k in target) {
      wrapProp(viewModel, target[k], k);
    }
    return proxy;
  }
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
  return mayBeVm(target) ? (target[VM_PROXY] ?? wrapObj(target)) : target;
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

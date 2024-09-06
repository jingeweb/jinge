/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AnyObj } from '../util';
import { isArray, isObject } from '../util';
import { type Watcher, destoryWatcher } from './watch';

export const VM_PARENTS = Symbol('VM_PARENTS');
export const VM_WATCHERS = Symbol('VM_WATCHERS');
export const VM_RAW = Symbol('VM_RAW');
export const VM_PROXY = Symbol('VM_PROXY');
export const VM_IGNORED = Symbol('VM_IGNORED');

// BEGIN_DROP_IN_PRODUCTION
export const ONLY_DEV_TARGET = Symbol('VM_ONLY_DEV_TARGET');
// END_DROP_IN_PRODUCTION

export type ViewModel<T extends object = AnyObj> = {
  [VM_PARENTS]?: Map<PropertyPathItem, Set<ViewModel>>;
  [VM_WATCHERS]?: Set<Watcher>;
  /**
   * 指向当前 ViewModel 所属的原始数据。vm() 函数包裹后返回的是 ViewModel 的 Proxy，不论是 ViewModel 还是它的 Proxy 都和原始数据是完全独立的两套。
   * 并且原始数据会挂在 [VM_RAW] 属性上，通过 vmRaw() 函数可以直接拿到这个属性，快速且高效地获取完整的原始数据。
   *
   * 为了保证数据的一致性，任何在 ViewModel 上的操作，都会同时在其原始数据上也操作。比如：
   * ```ts
   * const a = { a: 10 }; const b = { b: 10 };
   * const va = vm(a);
   * va.b = b;
   * console.log(a) // a 这个原始数据上，也会有 b 的原始数据，即： { a: 10, b: { 10 }}
   * console.log(toRaw(va) === a) // true
   * ```
   */
  [VM_RAW]: ViewModelRaw<T>;
  /**
   * 指向当前 ViewModel 所属的 Proxy，即 vm() 函数包裹后返回的 Proxy。从返回的 Proxy 上取 [VM_PROXY] 拿到的就还是这个 Proxy，不严格地话可以认为这是一个自引用属性。
   * 这个属性主要是用于快速判定一个 object 是否是一个包裹过的 ViewModel。
   */
  [VM_PROXY]: ViewModel<T>;

  // BEGIN_DROP_IN_PRODUCTION
  /** vm() 函数包裹后返回的 ViewModel 是 Proxy，研发测试版本需要能够拿到 Proxy 内部的实际 ViewModel 对象，即 Proxy 代理的 target，用于进行单元测试或排查问题。 */
  [ONLY_DEV_TARGET]?: any;
  // END_DROP_IN_PRODUCTION
} & T;

export type ViewModelRaw<T extends object = AnyObj> = T & {
  [VM_PROXY]: ViewModel<T>;
};
export type ViewModelIgnore<T extends object = AnyObj> = T & {
  [VM_IGNORED]: boolean;
};
export type ViewModelArray<T extends object = AnyObj> = ViewModel<T>[] &
  ViewModel<ViewModelRaw<T>[]>;

export type PropertyPathItem = string | number | symbol;

export function isInnerObj<T extends object>(v: unknown): v is T {
  if (v instanceof Node || v instanceof Error || v instanceof Promise) return true;
  const clazz = (
    v as {
      constructor: unknown;
    }
  ).constructor;
  return clazz === RegExp || clazz === Date || clazz === Boolean;
}

export function isViewModel<T extends object = AnyObj>(v: unknown): v is ViewModel<T> {
  return isObject(v) && v[VM_PROXY];
}

export function mayBeVm(v: unknown): v is ViewModel {
  return isObject(v) && !isInnerObj(v) && !v[VM_IGNORED];
}

export function addParent(child: ViewModel, parent: ViewModel, property: PropertyPathItem) {
  let map = child[VM_PARENTS];
  if (!map) {
    map = child[VM_PARENTS] = new Map();
  }
  let set = map.get(property);
  if (!set) {
    map.set(property, (set = new Set()));
  }
  set.add(parent);
}

export function removeParent(child: ViewModel, parent: ViewModel, property: PropertyPathItem) {
  child[VM_PARENTS]?.get(property)?.delete(parent);
  const ps = child[VM_PARENTS];
  if (!ps) return;
  const p = ps.get(property);
  if (!p) return;
  p.delete(parent);
  if (!p.size) ps.delete(property);
}

export function destroyViewModelCore(vm: ViewModel) {
  vm[VM_PARENTS]?.forEach((pset) => {
    pset.clear();
  });
  vm[VM_PARENTS]?.clear();
  // clear listeners
  vm[VM_WATCHERS]?.forEach((watcher) => {
    destoryWatcher(watcher);
  });
  vm[VM_WATCHERS]?.clear();
  // unlink wrapper proxy
  vm[VM_PROXY] = undefined as any;

  if (isArray(vm)) {
    vm.forEach((v, i) => {
      isViewModel(v) && removeParent(v, vm, i);
    });
  } else {
    for (const prop in vm) {
      const v = vm[prop];
      isViewModel(v) && removeParent(v, vm, prop);
    }
  }

  vm[VM_RAW][VM_PROXY] = undefined as any;
  vm[VM_RAW] = undefined as any;
}

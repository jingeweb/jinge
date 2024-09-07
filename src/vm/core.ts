/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AnyObj } from '../util';
import { isArray, isObject } from '../util';
import { type Watcher, destoryWatcher } from './watch';

export const VM_PARENTS = Symbol('VM_PARENTS');
export const VM_WATCHERS = Symbol('VM_WATCHERS');
export const VM_RAW = Symbol('VM_RAW');
export const VM_IGNORED = Symbol('VM_IGNORED');

export const GlobalViewModelWeakMap = new WeakMap<any, ViewModel>();
export type ViewModelParents = Map<ViewModel, Set<PropertyPathItem>>;
export type ViewModel<T extends object = AnyObj> = {
  [VM_PARENTS]?: ViewModelParents;
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
  [VM_RAW]: T;
} & T;

export type ViewModelIgnore<T extends object = AnyObj> = T & {
  [VM_IGNORED]: boolean;
};
export type ViewModelArray<T extends object = AnyObj> = ViewModel<T[]> & ViewModel<T>[];

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
  return isObject(v) && v[VM_RAW] !== undefined;
}

export function shouldBeVm(v: unknown): v is ViewModel {
  return isObject(v) && !isInnerObj(v) && !v[VM_IGNORED];
}

export function addParent(child: ViewModel, parent: ViewModel, property: PropertyPathItem) {
  let map = child[VM_PARENTS];
  if (!map) {
    map = child[VM_PARENTS] = new Map();
  }
  let set = map.get(parent);
  if (!set) {
    map.set(parent, (set = new Set()));
  }
  set.add(property);
}

export function removeParent(child: ViewModel, parent: ViewModel, property: PropertyPathItem) {
  const ps = child[VM_PARENTS];
  if (!ps) return;
  const p = ps.get(parent);
  if (!p) return;
  p.delete(property);
  if (!p.size) ps.delete(parent);
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
}

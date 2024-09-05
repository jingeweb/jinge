/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AnyObj } from '../util';
import { isObject } from '../util';
import { type Watcher, destoryWatcher } from './watch';

export const VM_PARENTS = Symbol('PARENTS');
export const VM_WATCHERS = Symbol('WATCHERS');
export const VM_RAW = Symbol('TARGET');
export const VM_PROXY = Symbol('PROXY');
export const VM_IGNORED = Symbol('IGNORED');

export interface ViewModel<T extends object = any> {
  [VM_PARENTS]?: Map<PropertyPathItem, Set<ViewModel>>;
  [VM_WATCHERS]?: Set<Watcher>;
  /** 指向当前 vm core 所属的原始数据 */
  [VM_RAW]: T;
  /** 指向当前 vm core 所属的 Proxy */
  [VM_PROXY]: any;
}

export interface ViewModelRaw {
  [VM_PROXY]: any;
}

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
}

export function shiftParent(child: ViewModel, parent: ViewModel, property: number, delta: number) {
  removeParent(child, parent, property);
  addParent(child, parent, property + delta);
}

export function destroyViewModelCore(vm: ViewModel) {
  vm[VM_PARENTS]?.clear();
  // clear listeners
  vm[VM_WATCHERS]?.forEach((watcher) => {
    destoryWatcher(watcher);
  });
  vm[VM_WATCHERS]?.clear();
  // unlink wrapper proxy
  vm[VM_PROXY] = undefined;

  const target = vm[VM_RAW] as ViewModelRaw;

  for (const prop in vm) {
    const v = (vm as unknown as Record<string, unknown>)[prop];
    if (isViewModel(v)) {
      removeParent(v, vm, prop);
    }
  }

  target[VM_PROXY] = undefined as any; // unlink vm target

  vm[VM_RAW] = undefined as any;
}

import type { AnyObj, AnyFn } from '../util';
import { isString, isObject } from '../util';
import type { Watcher } from './watch';

export const $$ = Symbol('$$');

export const PARENTS = Symbol();
export const WATCHERS = Symbol();
export const NOTIFIABLE = Symbol();
export const RELATED = Symbol();
export const SETTERS = Symbol();
export const TARGET = Symbol();
export const PROXY = Symbol();

export interface ViewModelCore<T extends object = AnyObj> {
  [PARENTS]?: Map<PropertyPathItem, Set<ViewModelCore>>;
  [WATCHERS]?: Set<Watcher>;
  [NOTIFIABLE]: boolean;
  [RELATED]?: Set<AnyFn>;
  [SETTERS]?: Map<PropertyPathItem, AnyFn | null>;
  /** 指向当前 vm core 所属的原始数据 */
  [TARGET]: T;
  /** 指向当前 vm core 所属的 Proxy */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [PROXY]: any;
}

export type ViewModel<T extends object = AnyObj> = {
  [$$]: ViewModelCore<T>;
} & T;

export type PropertyPathItem = string | number | symbol;

export function isInnerObj<T extends RegExp | Date | boolean = RegExp | Date | boolean>(
  v: unknown,
): v is T {
  const clazz = (
    v as {
      constructor: unknown;
    }
  ).constructor;
  return clazz === RegExp || clazz === Date || clazz === Boolean;
}

export function isViewModel<T extends object = AnyObj>(v: unknown): v is ViewModel<T> {
  return isObject(v) && v[$$];
}

export function isPublicProperty(v: unknown) {
  return isString(v) && (v as string).charCodeAt(0) !== 95;
}

export function addParent(child: ViewModelCore, parent: ViewModelCore, property: PropertyPathItem) {
  let map = child[PARENTS];
  if (!map) {
    map = child[PARENTS] = new Map();
  }
  let set = map.get(property);
  if (!set) {
    map.set(property, (set = new Set()));
  }
  set.add(parent);
}

export function removeParent(
  child: ViewModelCore,
  parent: ViewModelCore,
  property: PropertyPathItem,
) {
  child[PARENTS]?.get(property)?.delete(parent);
}

export function shiftParent(
  child: ViewModelCore,
  parent: ViewModelCore,
  property: number,
  delta: number,
) {
  removeParent(child, parent, property);
  addParent(child, parent, property + delta);
}

export function destroyViewModelCore(vm: ViewModelCore) {
  vm[NOTIFIABLE] = false;
  vm[PARENTS]?.clear();
  // clear listeners
  vm[WATCHERS]?.clear();
  // unlink wrapper proxy
  vm[PROXY] = undefined;

  vm[RELATED]?.forEach((unwatchFn) => {
    unwatchFn();
  });
  vm[RELATED]?.clear();

  const target = vm[TARGET] as ViewModel;

  /*
   * 解除 ViewModel 之间的 VM_PARENTS 关联。
   * 使用 getOwnPropertyNames 可以获取所有属性，但无法获取 setter 函数定义的属性。
   */
  vm[SETTERS]?.forEach((fn, prop) => {
    if (!fn) {
      return;
    }
    const v = target[prop];
    if (isViewModel(v)) {
      removeParent(v[$$], vm, prop);
    }
  });
  vm[SETTERS]?.clear();
  Object.getOwnPropertyNames(target).forEach((prop) => {
    const v = target[prop];
    if (isViewModel(v)) {
      removeParent(v[$$], vm, prop);
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  target[$$] = undefined as any; // unlink vm target
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vm[TARGET] = undefined as any;
}

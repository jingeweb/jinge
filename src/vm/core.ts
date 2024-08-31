import type { AnyObj } from '../util';
import { isString, isObject, isNumber } from '../util';
import { destoryWatcher, type Watcher } from './watch';

export const $$ = Symbol('$$');

export const VM_PARENTS = Symbol('PARENTS');
export const VM_WATCHERS = Symbol('WATCHERS');
export const VM_NOTIFIABLE = Symbol('NOTIFIABLE');
// export const VM_RELATED = Symbol('RELATED');
// export const VM_SETTERS = Symbol('SETTERS');

export const VM_TARGET = Symbol('TARGET');
export const VM_PROXY = Symbol('PROXY');

export interface ViewModelCore<T extends object = AnyObj> {
  [VM_PARENTS]?: Map<PropertyPathItem, Set<ViewModelCore>>;
  [VM_WATCHERS]?: Set<Watcher>;
  [VM_NOTIFIABLE]: boolean;
  // [VM_RELATED]?: Set<AnyFn>;
  // [VM_SETTERS]?: Map<PropertyPathItem, AnyFn | null>;
  /** 指向当前 vm core 所属的原始数据 */
  [VM_TARGET]: T;
  /** 指向当前 vm core 所属的 Proxy */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [VM_PROXY]: any;
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
  if (isNumber(v)) return true;
  return isString(v) && (v as string).charCodeAt(0) !== 95;
}

export function addParent(child: ViewModelCore, parent: ViewModelCore, property: PropertyPathItem) {
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

export function removeParent(
  child: ViewModelCore,
  parent: ViewModelCore,
  property: PropertyPathItem,
) {
  child[VM_PARENTS]?.get(property)?.delete(parent);
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
  vm[VM_NOTIFIABLE] = false;
  vm[VM_PARENTS]?.clear();
  // clear listeners
  vm[VM_WATCHERS]?.forEach((watcher) => {
    destoryWatcher(watcher);
  });
  vm[VM_WATCHERS]?.clear();
  // unlink wrapper proxy
  vm[VM_PROXY] = undefined;

  const target = vm[VM_TARGET] as ViewModel;

  // /*
  //  * 解除 ViewModel 之间的 VM_PARENTS 关联。
  //  * 使用 getOwnPropertyNames 可以获取所有属性，但无法获取 setter 函数定义的属性。
  //  */
  // vm[VM_SETTERS]?.forEach((fn, prop) => {
  //   if (!fn) {
  //     return;
  //   }
  //   const v = target[prop];
  //   if (isViewModel(v)) {
  //     removeParent(v[$$], vm, prop);
  //   }
  // });
  // vm[VM_SETTERS]?.clear();
  Object.getOwnPropertyNames(target).forEach((prop) => {
    const v = target[prop];
    if (isViewModel(v)) {
      removeParent(v[$$], vm, prop);
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  target[$$] = undefined as any; // unlink vm target
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vm[VM_TARGET] = undefined as any;
}

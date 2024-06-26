/* eslint-disable @typescript-eslint/no-explicit-any */

import type { AnyObj } from '../util';
import { isFunction, isObject } from '../util';
import type { PropertyPathItem, ViewModel, ViewModelCore } from './core';
import { $$, PARENTS, WATCHERS } from './core';

export const PATH = Symbol();
export const VALUE = Symbol();
export const DEEP = Symbol();
export const LISTENER = Symbol();
export const TARGET = Symbol();
export type WatchHandler<T = any> = (newValue: T | undefined, oldValue: T | undefined) => void;
export interface Watcher<T = any> {
  [TARGET]?: ViewModel;
  [PATH]?: PropertyPathItem[];
  [VALUE]?: T;
  [LISTENER]?: WatchHandler<T>;
  [DEEP]?: boolean;
}

function getValueByPath(target: unknown, path?: PropertyPathItem[]) {
  if (!path?.length) return target;
  if (!isObject(target)) return undefined;
  let idx = 0;
  let val = (target as AnyObj)[path[idx]];
  while (idx < path.length - 1) {
    if (!isObject(val)) return undefined;
    idx++;
    val = val[path[idx]];
  }
  return val;
}

/**
 * watch view-model by property path.
 * TODO: watchPath 能实现深度的基于 keyof 的类型严格的 Property Path 么？
 */
function innerWatch(
  vm: ViewModel,
  handler: WatchHandler,
  propertyPath?: PropertyPathItem[],
  deep?: boolean,
  immediate?: boolean,
) {
  const core = vm[$$];
  if (!core) throw new Error('watch() or watchPath() requires view-model, use vm() to wrap object');
  let watchers = core[WATCHERS];
  if (!watchers) {
    watchers = core[WATCHERS] = new Set();
  }
  const val = propertyPath ? getValueByPath(vm, propertyPath) : vm;
  const watcher: Watcher = {
    [TARGET]: vm,
    [PATH]: propertyPath,
    [VALUE]: val,
    [LISTENER]: handler,
    [DEEP]: deep,
  };
  watchers.add(watcher);
  if (immediate) {
    handler(val, undefined);
  }
  return () => {
    watcher[TARGET] = undefined;
    watcher[LISTENER] = undefined;
    watcher[VALUE] = undefined;
    watchers.delete(watcher);
  };
}
export type UnwatchFn = () => void;
export interface WatchOptions {
  immediate?: boolean;
  deep?: boolean;
}
export function watch<T extends object, P extends keyof T>(
  vm: T,
  property: P,
  handler: WatchHandler<T[P]>,
  options?: WatchOptions,
): UnwatchFn;
export function watch<T extends object>(vm: T, handler: WatchHandler<T>): UnwatchFn;
// export function watch<T extends object>(
//   vm: T,
//   propertyPath: PropertyPathItem[],
//   handler: WatchHandler<any>,
//   options?: WatchOptions,
// ): UnwatchFn;
export function watch(vm: any, propOrPathOrHanlder: any, handler?: any, options?: any) {
  if (isFunction(propOrPathOrHanlder)) {
    return innerWatch(vm, propOrPathOrHanlder, undefined, true);
  } else if (Array.isArray(propOrPathOrHanlder)) {
    return innerWatch(vm, handler, propOrPathOrHanlder, options?.deep, options?.immediate);
  } else {
    return innerWatch(vm, handler, [propOrPathOrHanlder], options?.deep, options?.immediate);
  }
}

function handleVmChange(vmCore: ViewModelCore, changedPath?: PropertyPathItem[]) {
  const watchers = vmCore[WATCHERS];
  if (!watchers?.size) return;
  watchers.forEach((watcher) => {
    const listener = watcher[LISTENER];
    const vm = watcher[TARGET];
    if (!vm || !listener) {
      // 如果 Watcher 已经被销毁，忽略
      return;
    }

    const watchPath = watcher[PATH];
    if (!watchPath?.length) {
      // 如果 watch 的 path 为空，说明是深度 watch 当前 ViewModel，直接触发 listener
      listener(vm, vm);
      return;
    }
    const deep = watcher[DEEP];
    const clen = changedPath?.length ?? 0;
    // 不论是否是深度 watch，如果发生变化的 changedPath 是监听的 watchPath 的前缀，则监听的 watchPath 都可能发生变化，需要检测和触发 listener
    let match =
      clen === 0 ||
      (clen <= watchPath.length && changedPath && !changedPath.some((v, i) => v !== watchPath[i]));
    if (!match && deep) {
      // 如果是深度 watch，且监听 watchPath 是发生变化的 changedPath 的前缀，说明发生变化的是深度监听对象的子元素，需要触发 listener
      if (
        clen > watchPath.length &&
        changedPath &&
        !watchPath.some((v, i) => changedPath[i] !== v)
      ) {
        match = true;
      }
    }
    if (!match) {
      return;
    }

    const oldValue = watcher[VALUE];
    const newValue = getValueByPath(vm, watchPath);
    if (deep || newValue !== oldValue) {
      watcher[VALUE] = newValue;
      listener(newValue, oldValue);
    }
  });
  vmCore[PARENTS]?.forEach((parents, prop) => {
    const parentPath = changedPath ? [prop, ...changedPath] : [prop];
    parents.forEach((parentVmCore) => {
      handleVmChange(parentVmCore, parentPath);
    });
  });
}
export function notifyVmChange(vm: ViewModel, changedPath?: PropertyPathItem[]) {
  handleVmChange(vm[$$], changedPath);
}

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { AnyObj } from '../util';
import { isFunction, isObject, setImmediate, clearImmediate, throwErr } from '../util';
import type { PropertyPathItem, ViewModel, ViewModelCore } from './core';
import { VM_TARGET, $$, VM_PARENTS, VM_WATCHERS } from './core';

export const VM_WATCHER_PATH = Symbol('PATH');
export const VM_WATCHER_VALUE = Symbol('VALUE');
export const VM_WATCHER_IS_DEEP = Symbol('IS_DEEP');
export const VM_WATCHER_LISTENER = Symbol('LISTENER');
export const VM_WATCHER_IMM = Symbol('IMM');
export type WatchHandler<T = any> = (
  newValue: T,
  oldValue: T | undefined,
  propertyPath?: PropertyPathItem[],
) => void;
export interface Watcher<T = any> {
  [VM_TARGET]?: ViewModel;
  [VM_WATCHER_PATH]?: PropertyPathItem[];
  [VM_WATCHER_VALUE]?: T;
  [VM_WATCHER_LISTENER]?: WatchHandler<T>;
  [VM_WATCHER_IS_DEEP]?: boolean;
  [VM_WATCHER_IMM]: number;
}

export function getValueByPath(target: unknown, path?: PropertyPathItem[]) {
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
export function watchPath(
  vm: ViewModel,
  handler: WatchHandler,
  propertyPath?: PropertyPathItem[],
  deep?: boolean,
  immediate?: boolean,
) {
  const core = vm[$$];
  if (!core) throwErr('watch-not-vm');

  const val = propertyPath ? getValueByPath(vm, propertyPath) : vm;

  if (immediate) {
    handler(val, undefined);
  }
  return innerWatchPath(vm, core, val, handler, propertyPath, deep);
}
export function innerWatchPath(
  vm: ViewModel,
  core: ViewModelCore,
  val: unknown,
  handler: WatchHandler,
  path?: PropertyPathItem[],
  deep?: boolean,
) {
  let watchers = core[VM_WATCHERS];
  if (!watchers) {
    watchers = core[VM_WATCHERS] = new Set();
  }
  const watcher: Watcher = {
    [VM_TARGET]: vm,
    [VM_WATCHER_PATH]: path,
    [VM_WATCHER_VALUE]: val,
    [VM_WATCHER_LISTENER]: handler,
    [VM_WATCHER_IS_DEEP]: deep,
    [VM_WATCHER_IMM]: 0,
  };
  watchers.add(watcher);
  return () => {
    watcher[VM_TARGET] = undefined;
    watcher[VM_WATCHER_LISTENER] = undefined;
    watcher[VM_WATCHER_VALUE] = undefined;
    clearImmediate(watcher[VM_WATCHER_IMM]);
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
export function watch<T extends object>(
  vm: T,
  propertyPath: PropertyPathItem[],
  handler: WatchHandler<any>,
  options?: WatchOptions,
): UnwatchFn;
export function watch(vm: any, propOrPathOrHanlder: any, handler?: any, options?: any) {
  if (isFunction(propOrPathOrHanlder)) {
    return watchPath(vm, propOrPathOrHanlder, undefined, true);
  } else if (Array.isArray(propOrPathOrHanlder)) {
    return watchPath(vm, handler, propOrPathOrHanlder, options?.deep, options?.immediate);
  } else {
    return watchPath(vm, handler, [propOrPathOrHanlder], options?.deep, options?.immediate);
  }
}

function handleVmChange(vmCore: ViewModelCore, changedPath?: PropertyPathItem[]) {
  vmCore[VM_WATCHERS]?.forEach((watcher) => {
    const listener = watcher[VM_WATCHER_LISTENER];
    const vm = watcher[VM_TARGET];
    if (!vm || !listener) {
      // 如果 Watcher 已经被销毁，忽略
      return;
    }

    const watchPath = watcher[VM_WATCHER_PATH];
    if (!watchPath?.length) {
      // 如果 watch 的 path 为空，说明是深度 watch 当前 ViewModel，直接触发 listener

      const imm = watcher[VM_WATCHER_IMM];
      if (imm > 0) clearImmediate(imm);
      watcher[VM_WATCHER_IMM] = setImmediate(() => {
        listener(vm, vm);
      });
      return;
    }
    const clen = changedPath?.length ?? 0;
    // console.log('check', changedPath, watchPath);
    // 不论是否是深度 watch，如果发生变化的 changedPath 是监听的 watchPath 的前缀，则监听的 watchPath 都可能发生变化，需要检测和触发 listener
    let match =
      clen === 0 ||
      (clen <= watchPath.length && changedPath && !changedPath.some((v, i) => v !== watchPath[i]));
    if (!match && watcher[VM_WATCHER_IS_DEEP]) {
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

    const imm = watcher[VM_WATCHER_IMM];
    if (imm > 0) clearImmediate(imm);
    watcher[VM_WATCHER_IMM] = setImmediate(() => {
      const deep = watcher[VM_WATCHER_IS_DEEP];
      const oldValue = watcher[VM_WATCHER_VALUE];
      const newValue = getValueByPath(vm, watchPath);
      newValue !== oldValue && (watcher[VM_WATCHER_VALUE] = newValue);
      // 如果是深度监听，则不论新旧数据的引用是否相同，都触发向外传递消息。
      (deep || newValue !== oldValue) && listener(newValue, oldValue, changedPath);
    });
  });
  vmCore[VM_PARENTS]?.forEach((parents, prop) => {
    const parentPath = changedPath ? [prop, ...changedPath] : [prop];
    parents.forEach((parentVmCore) => {
      handleVmChange(parentVmCore, parentPath);
    });
  });
}
export function notifyVmPropChange(vm: ViewModel, prop: PropertyPathItem) {
  handleVmChange(vm[$$], [prop]);
}
export function notifyVmArrayChange(vm: ViewModel) {
  handleVmChange(vm[$$]);
}

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { AnyObj } from '../util';
import { clearImmediate, isFunction, isObject, noopFn, setImmediate } from '../util';
import type { PropertyPathItem, ViewModel } from './core';
import { VM_PARENTS, VM_RAW, VM_WATCHERS, isViewModel } from './core';

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
  [VM_RAW]?: ViewModel;
  [VM_WATCHER_PATH]?: PropertyPathItem[];
  [VM_WATCHER_VALUE]?: T;
  [VM_WATCHER_LISTENER]?: WatchHandler<T>;
  [VM_WATCHER_IS_DEEP]: boolean;
  [VM_WATCHER_IMM]: {
    i: number;
    /**
     * 发生变更的路径，undefined 代表初始无变更，null 代表直接深度 watch 对象无变更 path。
     */
    p?: PropertyPathItem[] | null;
  };
}

export function destoryWatcher(watcher: Watcher) {
  watcher[VM_RAW] = undefined;
  watcher[VM_WATCHER_LISTENER] = undefined;
  watcher[VM_WATCHER_VALUE] = undefined;
  const imm = watcher[VM_WATCHER_IMM];
  clearImmediate(imm.i);
  imm.p = undefined;
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
  if (!isViewModel(vm)) return noopFn;

  const val = propertyPath ? getValueByPath(vm, propertyPath) : vm;

  if (immediate) {
    handler(val, undefined);
  }
  return innerWatchPath(vm, val, handler, propertyPath, deep);
}
export function innerWatchPath(
  vm: ViewModel,
  val: unknown,
  handler: WatchHandler,
  path?: PropertyPathItem[],
  deep?: boolean,
) {
  let watchers = vm[VM_WATCHERS];
  if (!watchers) {
    watchers = vm[VM_WATCHERS] = new Set();
  }
  const watcher: Watcher = {
    [VM_RAW]: vm,
    [VM_WATCHER_PATH]: path,
    [VM_WATCHER_VALUE]: val,
    [VM_WATCHER_LISTENER]: handler,
    [VM_WATCHER_IS_DEEP]: !!deep,
    [VM_WATCHER_IMM]: { i: 0, p: undefined },
  };
  watchers.add(watcher);
  return () => {
    watchers.delete(watcher);
    destoryWatcher(watcher);
  };
}
export type UnwatchFn = () => void;
export interface WatchOptions {
  immediate?: boolean;
  deep?: boolean;
}
export function vmWatch<T extends object, P extends keyof T>(
  vm: T,
  property: P,
  handler: WatchHandler<T[P]>,
  options?: WatchOptions,
): UnwatchFn;
export function vmWatch<T extends object>(vm: T, handler: WatchHandler<T>): UnwatchFn;
export function vmWatch<T extends object>(
  vm: T,
  propertyPath: PropertyPathItem[],
  handler: WatchHandler<any>,
  options?: WatchOptions,
): UnwatchFn;
export function vmWatch(vm: any, propOrPathOrHanlder: any, handler?: any, options?: any) {
  if (isFunction(propOrPathOrHanlder)) {
    return watchPath(vm, propOrPathOrHanlder, undefined, true);
  } else if (Array.isArray(propOrPathOrHanlder)) {
    return watchPath(vm, handler, propOrPathOrHanlder, options?.deep, options?.immediate);
  } else {
    return watchPath(vm, handler, [propOrPathOrHanlder], options?.deep, options?.immediate);
  }
}

function handleVmChange(vm: ViewModel, changedPath?: PropertyPathItem[]) {
  vm[VM_WATCHERS]?.forEach((watcher) => {
    const listener = watcher[VM_WATCHER_LISTENER];
    const vm = watcher[VM_RAW];
    if (!vm || !listener) {
      // 如果 Watcher 已经被销毁，忽略
      return;
    }

    const watchPath = watcher[VM_WATCHER_PATH];
    if (!watchPath?.length) {
      // 如果 watch 的 path 为空，说明是深度 watch 当前 ViewModel，直接触发 listener
      const imm = watcher[VM_WATCHER_IMM];
      if (imm.i > 0) clearImmediate(imm.i);
      imm.i = setImmediate(() => {
        listener(vm, vm);
      });
      imm.p = null;
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
    if (imm.i > 0) clearImmediate(imm.i);
    // 在某次 tick 中，如果只发生一次变更，则变更的 changedPath 就是对外 emit change 时的路径。
    // 但如果发生多次变更，会通过 setImmediate 来 debounce，只对外 emit  一次变更，
    //   这种情况下，始终保存路径最短的一次 changedPath 最终向外传递。如果两个 changedPath 的路径长度一样，
    //   则使用最先发生变更的 changedPath。
    // Vue 的 watch 没有 changedPath 这个属性，因此业界没有可参考的标准方案。
    // Jinge 框架引入 changedPath 是为了提供更精细化的数据变更监控，特别是在深度监听的场景下，以支撑 For 组件，以及其它可能的应用场景。
    if (!changedPath) {
      imm.p = null;
    } else if (imm.p === undefined) {
      imm.p = changedPath;
    } else if (imm.p !== null && changedPath.length < imm.p.length) {
      imm.p = changedPath;
    }
    imm.i = setImmediate(() => {
      const deep = watcher[VM_WATCHER_IS_DEEP];
      const oldValue = watcher[VM_WATCHER_VALUE];
      const newValue = getValueByPath(vm, watchPath);
      newValue !== oldValue && (watcher[VM_WATCHER_VALUE] = newValue);
      // 如果是深度监听，则不论新旧数据的引用是否相同，都触发向外传递消息。
      (deep || newValue !== oldValue) && listener(newValue, oldValue, imm.p ?? undefined);
      imm.i = 0;
      imm.p = undefined;
    });
  });
  vm[VM_PARENTS]?.forEach((props, parent) => {
    props.forEach((prop) => {
      handleVmChange(parent, changedPath ? [prop, ...changedPath] : [prop]);
    });
  });
}
export function notifyVmPropChange(vm: ViewModel, prop: PropertyPathItem) {
  handleVmChange(vm, [prop]);
}
export function notifyVmArrayChange(vm: ViewModel) {
  handleVmChange(vm);
}

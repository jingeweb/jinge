import type { AnyFn, AnyObj } from '../util';
import { isObject } from '../util';
import type { PropertyPathItem, ViewModel } from './core';
import { $$, NOTIFY_TREE } from './core';
import { loopCreateNode, loopUpClearNode, LISTENERS, DEEP_LISTENERS } from './notify_tree/node';

export type UnwatchFn = () => void;
export interface WatchOptions {
  immediate?: boolean;
  deep?: boolean;
}
/**
 * watch view-model by property path.
 * TODO: watchPath 能实现深度的基于 keyof 的类型严格的 Property Path 么？
 */
export function watchPath<T extends object>(
  vm: T,
  propertyPath: PropertyPathItem[],
  handler: AnyFn,
  options?: WatchOptions,
): UnwatchFn {
  const core = (vm as ViewModel)[$$];
  if (!core) throw new Error('watch() or watchPath() requires view-model, use vm() to wrap object');
  let tree = core[NOTIFY_TREE];
  if (!tree) core[NOTIFY_TREE] = tree = {};

  const deep = options?.deep;
  if (!propertyPath.length && !deep) throw new Error(`watchPath() requires propertyPath not empty`);

  const node = propertyPath.length ? loopCreateNode(tree, propertyPath) : tree;

  let listeners = node[deep ? DEEP_LISTENERS : LISTENERS];
  if (!listeners) listeners = node[deep ? DEEP_LISTENERS : LISTENERS] = new Set();
  listeners.add(handler);

  if (options?.immediate) {
    let idx = 0;
    let val = (vm as AnyObj)[propertyPath[idx]];
    while (idx < propertyPath.length - 1 && isObject(val)) {
      idx++;
      val = val[propertyPath[idx]];
    }
    handler();
  }
  return () => {
    listeners.delete(handler);
    if (listeners.size === 0) {
      loopUpClearNode(node);
    }
  };
}
export function watch<T extends object>(
  vm: T,
  property: keyof T,
  handler: AnyFn,
  options?: WatchOptions,
): UnwatchFn {
  return watchPath(vm, [property], handler, options);
}

import type { AnyFn } from 'src/util';
import type { PropertyPathItem } from '../core';

export const CHILDREN = Symbol();
export const PARENT = Symbol();
export const LISTENERS = Symbol();
export const DEEP_LISTENERS = Symbol();
export const PROP = Symbol();

export interface NotifyNode {
  [CHILDREN]?: Map<PropertyPathItem, NotifyNode>;
  [LISTENERS]?: Set<AnyFn>;
  [DEEP_LISTENERS]?: Set<AnyFn>;
  [PARENT]?: NotifyNode;
  [PROP]?: PropertyPathItem;
}
export function loopCreateNode(
  parentNode: NotifyNode,
  propertyPath: PropertyPathItem[],
  level = 0,
) {
  const propertyName = propertyPath[level];
  if (propertyName === null || propertyName === undefined) {
    throw new Error('property path meet null/undefined');
  }
  let map = parentNode[CHILDREN];
  if (!map) map = parentNode[CHILDREN] = new Map();
  let node = map.get(propertyName);
  if (!node) {
    node = {
      [PARENT]: parentNode,
      [PROP]: propertyName,
    };
    map.set(propertyName, node);
  }
  if (propertyPath.length - 1 === level) {
    return node;
  } else {
    return loopCreateNode(node, propertyPath, level + 1);
  }
}

export function loopGetNode(parentNode: NotifyNode, propertyPath: PropertyPathItem[], level = 0) {
  const propertyName = propertyPath[level];
  if (propertyName === null || propertyName === undefined) {
    throw new Error('property path meet null/undefined');
  }
  const node = parentNode[CHILDREN]?.get(propertyName);
  if (!node) {
    return null;
  }
  if (propertyPath.length - 1 === level) {
    return node;
  } else {
    return loopGetNode(node, propertyPath, level + 1);
  }
}

export function loopDownClearNode(node: NotifyNode) {
  node[CHILDREN]?.forEach((n) => loopDownClearNode(n));
  node[CHILDREN]?.clear();
  node[LISTENERS]?.clear();
  node[DEEP_LISTENERS]?.clear();
  node[PARENT] = undefined;
}

export function loopUpClearNode(node: NotifyNode) {
  if (node[LISTENERS]?.size || node[CHILDREN]?.size || node[DEEP_LISTENERS]?.size) {
    return;
  }
  const parent = node[PARENT];
  const prop = node[PROP];
  node[PARENT] = undefined;
  if (parent && prop) {
    parent[CHILDREN]?.delete(prop);
    loopUpClearNode(parent);
  }
}

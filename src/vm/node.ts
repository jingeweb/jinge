import { ViewModelNode, PropertyPathItem, getPropertyName } from './common';
import { handleCancel } from './notify';

export function loopCreateNode(parentNode: ViewModelNode, propertyPath: PropertyPathItem[], level = 0): ViewModelNode {
  const propertyName = getPropertyName(propertyPath[level]);
  if (!parentNode.__listeners) {
    parentNode.__listeners = new Map();
  }
  let node = parentNode.__listeners.get(propertyName);
  if (!node) {
    node = {
      __parent: parentNode,
      __property: propertyName,
      __handlers: null,
      __listeners: null,
    };
    parentNode.__listeners.set(propertyName, node);
  }
  if (propertyPath.length - 1 === level) {
    return node;
  } else {
    return loopCreateNode(node, propertyPath, level + 1);
  }
}

export function loopGetNode(parentNode: ViewModelNode, propertyPath: PropertyPathItem[], level = 0): ViewModelNode {
  const propertyName = getPropertyName(propertyPath[level]);
  if (!propertyName) {
    return null;
  }
  const node = parentNode.__listeners?.get(propertyName);
  if (!node) {
    return null;
  }
  if (propertyPath.length - 1 === level) {
    return node;
  } else {
    return loopGetNode(node, propertyPath, level + 1);
  }
}

export function deleteNode(node: ViewModelNode): ViewModelNode {
  if ((node?.__handlers && node.__handlers.length > 0) || (node.__listeners && node.__listeners.size > 0)) {
    return null;
  }
  /**
   * if one node don't have any listener or child, delete it.
   */
  const parent = node.__parent;
  const property = node.__property;
  node.__parent = null; // unlink parent.
  parent.__listeners.delete(property);
  return parent;
}

export function loopClearNode(node: ViewModelNode): void {
  const listeners = node.__listeners;
  if (listeners) {
    // loop clear all child nodes
    listeners.forEach((sn) => loopClearNode(sn));
    node.__listeners = null;
  }
  // destroy all handlers
  const handlers = node.__handlers;
  if (handlers) {
    // clear handler waiting to execute
    handlers.forEach(handleCancel);
    node.__handlers = null;
  }
  // unlink parent
  node.__parent = null;
}

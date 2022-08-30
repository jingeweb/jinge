import { setImmediate, clearImmediate } from '../util';
import { ViewModelNode, ViewModelWatchHandler, PropertyPathItem, getPropertyName } from './common';

const handleTasks: Map<
  ViewModelWatchHandler,
  {
    immediate: number;
    propertyPath: PropertyPathItem[];
  }
> = new Map();

export function handleCancel(handler: ViewModelWatchHandler): void {
  const t = handleTasks.get(handler);
  if (t) {
    clearImmediate(t.immediate);
    handleTasks.delete(handler);
  }
}

export function handleOnce(handler: ViewModelWatchHandler, propertyPath: PropertyPathItem[]): void {
  if (handleTasks.has(handler)) {
    return;
  }
  const imm = setImmediate(() => {
    const arg = handleTasks.get(handler);
    try {
      handler(arg.propertyPath);
    } finally {
      handleTasks.delete(handler);
    }
  });
  handleTasks.set(handler, {
    immediate: imm,
    propertyPath: propertyPath,
  });
}

export function loopHandle(propertyPath: PropertyPathItem[], node: ViewModelNode, immediate: boolean): void {
  const handlers = node.__handlers;
  handlers?.forEach((handler) => {
    if (immediate) {
      handler(propertyPath);
    } else {
      handleOnce(handler, propertyPath);
    }
  });
  const listeners = node.__listeners;
  listeners?.forEach((c) => {
    loopHandle(propertyPath, c, immediate);
  });
}

export function loopNotify(vm: ViewModelNode, propertyPath: PropertyPathItem[], immediate: boolean, level = 0): void {
  const listeners = vm.__listeners;
  if (!listeners) {
    return;
  }
  const propertyName = getPropertyName(propertyPath[level]);
  if (!propertyName) {
    return;
  }
  let node = listeners.get(propertyName);
  if (node) {
    if (propertyPath.length - 1 === level) {
      // loopHandle(props, node, config[CFG_VM_DEBUG] ? null : imms);
      loopHandle(propertyPath, node, immediate);
    } else {
      loopNotify(node, propertyPath, immediate, level + 1);
    }
  }
  node = listeners.get('*');
  if (node) {
    if (propertyPath.length - 1 === level) {
      loopHandle(propertyPath, node, true);
    } else {
      loopNotify(node, propertyPath, immediate, level + 1);
    }
  }
  node = listeners.get('**');
  if (node) {
    loopHandle(propertyPath, node, true);
  }
}

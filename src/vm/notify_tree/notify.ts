import { isObject } from 'src/util';
import type { PropertyPathItem, ViewModel, ViewModelCore } from '../core';
import { $$, NOTIFIABLE, NOTIFY_TREE, PARENTS, PROXY } from '../core';
import type { NotifyNode } from './node';
import { CHILDREN, DEEP_LISTENERS, LISTENERS } from './node';

// const handleTasks: Map<
//   AnyFn,
//   {
//     immediate: number;
//     propertyPath: PropertyPathItem[];
//   }
// > = new Map();

// export function handleCancel(handler: AnyFn): void {
//   const t = handleTasks.get(handler);
//   if (t) {
//     clearImmediate(t.immediate);
//     handleTasks.delete(handler);
//   }
// }

// export function handleOnce(handler: AnyFn, propertyPath: PropertyPathItem[]): void {
//   if (handleTasks.has(handler)) {
//     return;
//   }
//   const imm = setImmediate(() => {
//     const arg = handleTasks.get(handler);
//     try {
//       handler(arg.propertyPath);
//     } finally {
//       handleTasks.delete(handler);
//     }
//   });
//   handleTasks.set(handler, {
//     immediate: imm,
//     propertyPath: propertyPath,
//   });
// }

export function loopHandle(
  propertyPath: PropertyPathItem[],
  node: NotifyNode,
  oldV: unknown,
  newV: unknown,
): void {
  node[LISTENERS]?.forEach((handler) => {
    // if (immediate) {
    //   handler(propertyPath);
    // } else {
    //   handleOnce(handler, propertyPath);
    // }
    handler(newV, oldV);
  });
  node[CHILDREN]?.forEach((c) => {
    loopHandle(propertyPath, c);
  });
}

function doNotify(
  newValue: unknown,
  oldValue: unknown,
  notifyTree: NotifyNode,
  prop: PropertyPathItem,
  subPath?: PropertyPathItem[],
) {
  let node = notifyTree[CHILDREN]?.get(prop);
  if (!node) return;
  node[DEEP_LISTENERS]?.forEach((handler) => {
    handler(newValue, oldValue);
  });

  if (subPath?.length) {
    for (let i = 0; i < subPath.length; i++) {
      const subProp = subPath[i];
      node = node[CHILDREN]?.get(subProp);
      if (!node) {
        return;
      } else {
        node[DEEP_LISTENERS]?.forEach((handler) => {
          handler(newValue, oldValue);
        });
        newValue = isObject(newValue) ? newValue[subProp] : undefined;
        oldValue = isObject(oldValue) ? oldValue[subProp] : undefined;
      }
    }
  }
  node[LISTENERS]?.forEach((handler) => {
    handler(newValue, oldValue);
  });
}
function loopNotify(
  newValue: unknown,
  oldValue: unknown,
  vmCore: ViewModelCore,
  prop: PropertyPathItem,
  subPath?: PropertyPathItem[],
) {
  if (!vmCore[NOTIFIABLE]) {
    return;
  }
  const notifyTree = vmCore[NOTIFY_TREE];
  const vm = vmCore[PROXY];
  if (notifyTree) {
    notifyTree[DEEP_LISTENERS]?.forEach((handler) => {
      handler(vm, vm);
    });
    doNotify(newValue, oldValue, notifyTree, prop, subPath);
  }
  vmCore[PARENTS]?.forEach((parentVmCores, parentProp) => {
    parentVmCores.forEach((parentVmCore) => {
      loopNotify(parentVmCore, parentProp, subPath ? [prop, ...subPath] : [prop]);
    });
  });
}

const obj = { a: { b: { c: 10 } } };
xxxwatch(obj, ['a', 'b', 'c']);
const xx = obj.a;
xx.b = { c: 20 };
xxxwatch(obj.a.b, 'c');

export function notifyVmPropertyChange(
  vm: ViewModel,
  property: PropertyPathItem,
  oldValue: unknown,
  newValue: unknown,
) {
  loopNotify(newValue, oldValue, vm[$$], property);
}

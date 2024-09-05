/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AnyFn, AnyObj } from '../util';
import { isArray, isObject, isPromise, isString, isSymbol, isUndefined, throwErr } from '../util';

import type { PropertyPathItem, ViewModel, ViewModelRaw } from './core';
import {
  VM_IGNORED,
  VM_PROXY,
  VM_RAW,
  addParent,
  isInnerObj,
  isViewModel,
  removeParent,
  shiftParent,
} from './core';
import { notifyVmArrayChange, notifyVmPropChange } from './watch';

type ViewModelArray = any[] & ViewModel<ViewModel[]>;

function __propSetHandler(
  target: ViewModel,
  prop: PropertyPathItem,
  value: unknown,
  setFn: (target: ViewModel, prop: PropertyPathItem, value: unknown) => void,
) {
  if (isObject(value)) {
    let valueViewModel = value[VM_PROXY];
    if (valueViewModel) {
      if (isSymbol(prop)) {
        target[VM_RAW][prop] = valueViewModel[VM_RAW];
      } else {
      }
    } else {
      if (!isInnerObj(value) && !value[VM_IGNORED]) {
        valueViewModel = wrapObj(value);
        const oldViewModel = (target as AnyObj)[prop] as ViewModel;
        if (oldViewModel) {
          removeParent(oldViewModel, target, prop);
        }
        target[prop] = valueViewModel;
        target[VM_RAW][prop] = value;
        addParent(valueViewModel, target, prop);
        notifyVmPropChange(target, prop);
      } else {
        const oldVal = (target as AnyObj)[prop] ?? target[VM_RAW][prop];
        if (oldVal === value) {
          return true;
        }
      }
    }
  } else {
    if (isSymbol(prop)) {
      // 如果 prop 是 symbol，value 又不是 object（也就不可能是 ViewModel）, 则直接赋值到原始数据上。
      target[VM_RAW][prop] = value;
      return true;
    }
    const oldViewModel = (target as AnyObj)[prop] as ViewModel;
    if (oldViewModel) {
      // value 不是 object 就不可能是 viewmodel，老的 viewmodel 一定需要卸载。
      (target as AnyObj)[prop] = undefined;
      removeParent(oldViewModel, target, prop);
    }
    const oldVal = oldViewModel ?? target[VM_RAW][prop];
    if (oldVal !== value) {
      target[VM_RAW][prop] = value;
      notifyVmPropChange(target, prop);
    } else {
      // 如果新旧数据完全相同，则不需要做任何响应。
    }
  }

  return true;
}

function __objectPropSetFn(target: ViewModel, prop: PropertyPathItem, value: unknown) {
  target[prop] = value;
}

function objectPropSetHandler(target: ViewModel, prop: PropertyPathItem, value: unknown) {
  if (!target[VM_PROXY]) {
    // ViewModel has been destroied.
    return true;
  }
  return __propSetHandler(target, prop, value, __objectPropSetFn);
}

function arrayLengthSetHandler(target: ViewModelArray, value: number) {
  const oldLen = target.length;
  if (oldLen === value) return true;
  if (oldLen > value) {
    for (let i = value; i < oldLen; i++) {
      const v = target[i];
      if (isViewModel(v)) {
        removeParent(v[$$], target[$$], i);
      }
    }
  }
  target.length = value;
  notifyVmArrayChange(target);
  return true;
}

function arrayPropSetHandler(target: ViewModelArray, prop: PropertyPathItem, value: unknown) {
  if (!target[$$]) {
    return true;
  }
  if (prop === 'length') {
    return arrayLengthSetHandler(target as ViewModelArray, value as number);
  }
  /**
   * 即便是 arr[0] 这样的取值，在 Proxy 的 set 里面，传递的 property 也是 string 类型，即 "0"。
   * 因此，对数组也使用和对象一致的 objectPropSetHandler 来处理。
   */
  if (isString(prop) && /^\d+$/.test(prop as string)) {
    prop = parseInt(prop as string);
  }
  return __propSetHandler(target as ViewModel, prop, value, __objectPropSetFn);
}

const ObjectProxyHandler: ProxyHandler<any> = {
  get(target, prop) {
    return target[prop] ?? target[VM_RAW][prop];
  },
  set: objectPropSetHandler,
};

// const PromiseProxyHandler = {
//   get(target: ViewModelPromise, prop: PropertyPathItem): unknown {
//     if (prop === 'then' || prop === 'catch') {
//       const v = target[prop];
//       return function (...args: unknown[]): unknown {
//         return v.call(target, ...args);
//       };
//     } else {
//       return target[prop];
//     }
//   },
//   set: objectPropSetHandler,
// };

function _arrayReverseSort(target: ViewModelArray, fn: () => void): ViewModelArray {
  const prev = target.slice();
  fn();

  target.forEach((it, i) => {
    const p = prev[i];
    if (p === it) return;
    if (isViewModel(p)) {
      removeParent(p[$$], target[$$], i);
    }
    if (isViewModel(it)) {
      addParent(it[$$], target[$$], i);
    }
  });
  notifyVmArrayChange(target);

  return target[$$][VM_PROXY] as ViewModelArray;
}

function wrapSubArray(arr: ViewModelArray, wrapEachItem = false) {
  const proxy = new Proxy(arr, ArrayProxyHandler);
  arr[$$] = {
    [VM_RAW]: arr,
    [VM_PROXY]: proxy,
  };
  // handleVMDebug(arr);
  arr.forEach((it, i) => {
    if (!isObject(it) || isInnerObj(it)) {
      return;
    }
    if (it[$$]) {
      addParent(it[$$], (arr as ViewModelArray)[$$], i);
    } else if (wrapEachItem) {
      arr[i] = wrapObj(it as ViewModel);
    }
  });
  return proxy;
}

function _arrayShiftOrUnshiftProp(arr: ViewModelArray, delta: number) {
  arr.forEach((el, i) => {
    if (!isViewModel(el)) return;
    shiftParent(el[$$], arr[$$], i, delta);
  });
}

function _argAssert(arg: unknown, fn: string): arg is ViewModelCore {
  if (isObject(arg)) {
    if (!($$ in (arg as Record<symbol, unknown>))) {
      throwErr('array-item-not-vm', fn);
    } else {
      return true;
    }
  } else {
    return false;
  }
}

const ArrayFns = {
  splice(target: ViewModelArray, idx: number, delCount: number, ...args: ViewModel[]) {
    if (idx < 0) idx = 0;
    args.forEach((arg, i) => {
      if (_argAssert(arg, 'splice')) {
        addParent(arg[$$], target[$$], idx + i);
      }
    });

    for (let i = 0; i < delCount; i++) {
      if (idx + i >= target.length) break;
      const el = target[idx + i];
      if (isViewModel(el)) {
        removeParent(el[$$], target[$$], idx + i);
      }
    }
    const delta = args.length - delCount;
    if (delta !== 0) {
      for (let i = idx + delCount; i < target.length; i++) {
        const el = target[i];
        if (!isViewModel(el)) {
          continue;
        }
        shiftParent(el[$$], target[$$], i, delta);
      }
    }
    const rtn = wrapSubArray(target.splice(idx, delCount, ...args) as ViewModelArray);
    notifyVmArrayChange(target);
    return rtn;
  },
  shift(target: ViewModelArray) {
    const oldLen = target.length;
    if (oldLen === 0) {
      return undefined;
    }
    _arrayShiftOrUnshiftProp(target, -1);
    const el = target.shift();
    if (isViewModel(el)) {
      removeParent(el[$$], target[$$], -1);
    }
    notifyVmArrayChange(target);
    return el;
  },
  unshift(target: ViewModelArray, ...args: ViewModel[]) {
    const oldLen = target.length;
    if (args.length === 0) return oldLen;
    args.forEach((arg, i) => {
      if (_argAssert(arg, 'unshift')) {
        addParent(arg[$$], target[$$], i);
      }
    });
    _arrayShiftOrUnshiftProp(target, args.length);
    const rtn = target.unshift(...args);
    notifyVmArrayChange(target);
    return rtn;
  },
  pop(target: ViewModelArray) {
    const oldLen = target.length;
    if (oldLen === 0) {
      return undefined;
    }
    const el = target.pop();
    if (isViewModel(el)) {
      removeParent(el[$$], target[$$], oldLen - 1);
    }
    notifyVmArrayChange(target);
    return el;
  },
  push(target: ViewModelArray, ...args: ViewModel[]): number {
    if (args.length === 0) return 0;
    args.forEach((arg, i) => {
      if (_argAssert(arg, 'push')) {
        addParent(arg[$$], target[$$], target.length + i);
      }
    });
    const rtn = target.push(...args);
    notifyVmArrayChange(target);

    return rtn;
  },
  fill(target: ViewModelArray, v: ViewModel): ViewModelArray {
    _argAssert(v, 'fill');
    target.forEach((it, i) => {
      if (it === v && !isUndefined(it)) {
        return;
      }
      if (isViewModel(it)) {
        removeParent(it[$$], target[$$], i);
      }
      target[i] = v;
      if (isViewModel(v)) {
        addParent(v[$$], target[$$], i);
      }
    });
    notifyVmArrayChange(target);
    return target[$$][VM_PROXY] as ViewModelArray;
  },
  reverse(target: ViewModelArray): ViewModelArray {
    return _arrayReverseSort(target, () => target.reverse());
  },
  sort(target: ViewModelArray, fn: (...args: unknown[]) => number) {
    return _arrayReverseSort(target, () => target.sort(fn));
  },
  concat(target: ViewModelArray, arr: ViewModelArray) {
    _argAssert(arr, 'concat');
    return wrapSubArray(target.concat(arr) as ViewModelArray);
  },
  filter(target: ViewModelArray, fn: (it: ViewModel, idx: number) => boolean) {
    return wrapSubArray(target.filter(fn) as ViewModelArray);
  },
  slice(target: ViewModelArray, si: number, ei: number) {
    return wrapSubArray(target.slice(si, ei) as ViewModelArray);
  },
  map(target: ViewModelArray, fn: (it: ViewModel, idx: number) => ViewModel) {
    return wrapSubArray(target.map(fn) as ViewModelArray, true);
  },
};

const ArrayProxyHandler = {
  get(target: ViewModelArray, prop: PropertyPathItem): unknown {
    if (prop in ArrayFns) {
      const fn = ArrayFns[prop as keyof typeof ArrayFns];

      return (...args: any[]) => (fn as AnyFn)(target, ...args);
    } else {
      return target[prop as number];
    }
  },
  set: arrayPropSetHandler,
};

function wrapProp(parent: ViewModel, child: unknown, property: PropertyPathItem) {
  if (!isObject(child) || isInnerObj(child) || child[VM_IGNORED]) {
    return;
  }
  let vm = child[VM_PROXY];
  if (!vm) {
    (parent as unknown as Record<PropertyPathItem, ViewModel>)[property] = vm = wrapObj(child);
  }
  addParent(vm, parent, property);
}

function wrapObj<T extends object>(target: T) {
  if (isArray(target)) {
    const viewModel = [] as unknown as ViewModel;
    viewModel[VM_RAW] = target;
    const proxy = new Proxy(viewModel, ArrayProxyHandler);
    viewModel[VM_PROXY] = (target as unknown as ViewModelRaw)[VM_PROXY] = proxy;
    for (let i = 0; i < target.length; i++) {
      wrapProp(viewModel, target[i], i);
    }
    return proxy as T;
  } else {
    const viewModel: ViewModel = {
      [VM_RAW]: target,
      [VM_PROXY]: undefined,
    };
    const proxy = new Proxy(viewModel, ObjectProxyHandler);
    viewModel[VM_PROXY] = (target as ViewModelRaw)[VM_PROXY] = proxy;
    for (const k in target) {
      wrapProp(viewModel as ViewModel<T>, target[k], k);
    }
    return proxy as T;
  }
}

/**
 * 将给定的 target 对象进行 ViewModel 包裹，返回 Proxy。后续可对 ViewModel 进行 watch 监听变更。
 * 该绑定为深度递归绑定，属性值如果是 object/array 也会进行递归包裹。
 *
 * 对于同一个 target 对象，多次调用 vm() 返回拿到的是同一个 ViewModel。比如：
 * ```ts
 * import { vm } from 'jinge';
 * const someData = { a: 10 };
 * const v1 = vm(someData);
 * const v2 = vm(someData);
 * console.log(v1 === v2, v1 === someData); // true, false
 * ```
 *
 * 需要注意的是，如果 target 对象的属性 key 是 Symbol，则不会进行包裹。赋值时同理。
 */
export function vm<T extends object>(target: T): T {
  if (!isObject(target) || isInnerObj(target) || target[VM_IGNORED]) return target;
  return target[VM_PROXY] ?? wrapObj(target);
}

/**
 * 拿到目标 ViewModel 上的原始数据。目标 ViewModel 是深度递归包裹的 Proxy 树，拿到其原始数据。
 */
export function vmRaw<T extends object>(target: T): T {
  if (!isObject(target)) return target;
  return (target as ViewModel)[VM_RAW] ?? target;
}
/**
 * 标记目标对象数据为 vm ignored。被忽略后的数据，在赋予到其它 ViewModel 属性上时，不会被转换成 ViewModel
 */
export function vmIgnore<T extends object>(target: T) {
  if (
    isObject<{
      [VM_IGNORED]: boolean;
    }>(target)
  ) {
    target[VM_IGNORED] = true;
  }
}

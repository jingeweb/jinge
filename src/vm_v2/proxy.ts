import type { Component } from 'src/core';
import type { AnyFn } from '../util';
import { isNumber, isArray, isObject, isFunction, isPromise, isUndefined, warn } from '../util';

import type { PropertyPathItem, ViewModelCore, ViewModel } from './core';
import {
  addParent,
  isViewModel,
  removeParent,
  shiftParent,
  isPublicProperty,
  isInnerObj,
  $$,
  PROXY,
  NOTIFIABLE,
  TARGET,
  SETTERS,
} from './core';
import { notifyVmChange } from './watch';

type ViewModelArray = ViewModel<ViewModel[]>;

function newViewModelCore<T extends object>(target: T, notifiable = true) {
  const vm = {
    [NOTIFIABLE]: notifiable,
    [TARGET]: target,
  } as ViewModelCore<T>;
  Object.defineProperty(target, $$, {
    value: vm,
    writable: false,
    configurable: true,
    enumerable: false,
  });
  return vm;
}

/**
 * check if property named "prop" is setter of instance "obj",
 * if it's setter, return setter function, otherwise return null.
 *
 * 检测名称为 "prop" 的属性是否是 setter，如果是，返回该 setter 函数，
 * 否则，返回 null。
 * 由于 obj 可能是有继承关系的类的实例，因此需要向上检测继承的类的 prototype。
 */
function getSetterFnIfPropIsSetter(obj: ViewModel, prop: PropertyPathItem) {
  let map = obj[$$][SETTERS];
  if (!map) {
    obj[$$][SETTERS] = map = new Map();
  }
  type Constructor = { prototype: unknown };
  if (!map.has(prop)) {
    let clazz: Constructor = obj.constructor as Constructor;
    let desc = Object.getOwnPropertyDescriptor(clazz.prototype, prop);
    let fn: AnyFn | null;
    if (desc) {
      fn = isFunction(desc.set) ? desc.set : null;
      map.set(prop, fn);
      return fn;
    }
    // lookup to check parent classes
    clazz = Object.getPrototypeOf(clazz) as Constructor;
    while (clazz?.prototype) {
      desc = Object.getOwnPropertyDescriptor(clazz.prototype, prop);
      if (desc) {
        fn = isFunction(desc.set) ? desc.set : null;
        map.set(prop, fn);
        return fn;
      }
      clazz = Object.getPrototypeOf(clazz);
    }
    map.set(prop, null);
    return null;
  } else {
    return map.get(prop);
  }
}

function __propSetHandler(
  target: ViewModel,
  prop: PropertyPathItem,
  value: unknown,
  setFn: (target: ViewModel, prop: PropertyPathItem, value: unknown) => void,
) {
  const isPubProp = isPublicProperty(prop);
  if (!isPubProp) {
    target[prop] = value;
    return true;
  }
  const oldVal = target[prop];
  if (oldVal === value && !isUndefined(value)) {
    return true;
  }
  const newValMaybeVM = isObject(value) && !isInnerObj(value);
  if (newValMaybeVM && isPubProp && !(value as ViewModel)[$$]) {
    value = wrapVm(value as object);
  }
  // console.log(`'${prop}' changed from ${store[prop]} to ${value}`);
  if (isViewModel(oldVal)) {
    removeParent(oldVal[$$], target[$$], prop);
  }
  setFn(target, prop, value);
  if (newValMaybeVM) {
    addParent((value as ViewModel)[$$], target[$$], prop);
  }
  notifyVmChange(target, [prop]);
  return true;
}

function __objectPropSetFn(target: ViewModel, prop: PropertyPathItem, value: unknown) {
  target[prop] = value;
}

function __componentPropSetFn(target: ViewModel, prop: PropertyPathItem, value: unknown) {
  /**
   * we must ensure `this` in setter function to be `Proxy`
   *
   * 首先判断当前赋值的变量名，是否对应了一个 setter 函数，
   * 如果是 setter 函数，则应该显式地调用，
   *   并将 `this` 设置为该 target 的包装 Proxy，
   *   这样才能保正 setter 函数中其它赋值语句能触发 notify。
   * 如果不是 setter 函数，则简单地使用 target\[prop\] 赋值即可。
   */
  const setterFn = getSetterFnIfPropIsSetter(target, prop);
  if (setterFn) {
    setterFn.call(target[$$][PROXY], value);
  } else {
    target[prop] = value;
  }
}

function objectPropSetHandler(target: ViewModel, prop: PropertyPathItem, value: unknown) {
  if (!target[$$]) {
    // ViewModel has been destroied.
    return true;
  }
  return __propSetHandler(target, prop, value, __objectPropSetFn);
}

function attrsPropSetHandler(target: ViewModel, prop: PropertyPathItem, value: unknown) {
  if (!target[$$]) {
    // ViewModel has been destroied.
    return true;
  }
  return __propSetHandler(target as ViewModel, prop, value, __objectPropSetFn);
}

function componentPropSetHandler(target: ViewModel, prop: PropertyPathItem, value: unknown) {
  if (!target[$$]) {
    warn(
      `call setter "${prop.toString()}" after destroied, resources such as setInterval maybe not released before destroy. component:`,
      target,
    );
    return true;
  }
  return __propSetHandler(target, prop, value, __componentPropSetFn);
}

function arrayLengthSetHandler(target: ViewModelArray, value: number) {
  if (!isNumber(value)) {
    throw new Error('bad argument. array length must be validate number.');
  }
  const oldLen = target.length;
  if (oldLen === value) return true;
  if (oldLen > value) {
    for (let i = value; i < oldLen; i++) {
      const v = target[i];
      if (isViewModel(v)) {
        removeParent(v[$$], target[$$], i);
      }
    }
  } else {
    // length 增加，数组的元素值没有发生变化，前后都是 undefined。
  }
  target.length = value;
  notifyVmChange(target);
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
  return __propSetHandler(target as ViewModel, prop, value, __objectPropSetFn);
}

const ObjectProxyHandler = {
  set: objectPropSetHandler,
};

const PromiseProxyHandler = {
  get(target: ViewModel, prop: PropertyPathItem): unknown {
    if (prop === 'then' || prop === 'catch') {
      const v = target[prop];
      return function (...args: unknown[]): unknown {
        return v.call(target, ...args);
      };
    } else {
      return target[prop];
    }
  },
  set: objectPropSetHandler,
};

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
  notifyVmChange(target);

  return target[$$][PROXY] as ViewModelArray;
}

function wrapSubArray(arr: unknown[], wrapEachItem = false) {
  const vmCore = newViewModelCore(arr);
  const proxy = new Proxy(arr, ArrayProxyHandler);
  vmCore[PROXY] = proxy;
  // handleVMDebug(arr);
  arr.forEach((it, i) => {
    if (isViewModel(it)) {
      addParent(it[$$], (arr as ViewModelArray)[$$], i);
    } else if (wrapEachItem) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      arr[i] = wrapVm(it as ViewModel);
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
      throw new Error(`argument passed to Array.${fn} must be ViewModel if the array is ViewModel`);
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
    notifyVmChange(target);
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
    notifyVmChange(target);
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
    notifyVmChange(target);
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
    notifyVmChange(target);
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
    notifyVmChange(target);

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
    notifyVmChange(target);
    return target[$$][PROXY] as ViewModelArray;
  },
  reverse(target: ViewModelArray): ViewModelArray {
    return _arrayReverseSort(target, () => target.reverse());
  },
  sort(target: ViewModelArray, fn: (...args: unknown[]) => number) {
    return _arrayReverseSort(target, () => target.sort(fn));
  },
  concat(target: ViewModelArray, arr: ViewModelArray) {
    _argAssert(arr, 'concat');
    return wrapSubArray(target.concat(arr));
  },
  filter(target: ViewModelArray, fn: (it: ViewModel, idx: number) => boolean) {
    return wrapSubArray(target.filter(fn));
  },
  slice(target: ViewModelArray, si: number, ei: number) {
    return wrapSubArray(target.slice(si, ei));
  },
  map(target: ViewModelArray, fn: (it: ViewModel, idx: number) => ViewModel) {
    return wrapSubArray(target.map(fn), true);
  },
};

const ArrayProxyHandler = {
  get(target: ViewModelArray, prop: PropertyPathItem): unknown {
    if (prop in ArrayFns) {
      const fn = ArrayFns[prop as keyof typeof ArrayFns];
      return fn.bind(target);
    } else {
      return target[prop as number];
    }
  },
  set: arrayPropSetHandler,
};

function wrapProp(parent: ViewModel, child: unknown, property: PropertyPathItem) {
  if (!isObject(child) || isInnerObj(child)) {
    return;
  }
  if (!child[$$]) {
    parent[property] = child = wrapVm(child);
  }
  addParent((child as ViewModel)[$$], parent[$$], property);
}

export function wrapVm<T extends object>(target: T) {
  if (isObject(target)) {
    // directly return if alreay is ViewModel or inner object(Date/RegExp/Boolean).
    if (isInnerObj(target)) {
      return target;
    }

    const proxy = (target as ViewModel)[$$]?.[PROXY];
    if (proxy) return proxy;

    const isArr = isArray(target);
    if (isArr) {
      const vmCore = newViewModelCore(target);
      const proxy = new Proxy(target as unknown as ViewModelArray, ArrayProxyHandler);
      vmCore[PROXY] = proxy;
      for (let i = 0; i < target.length; i++) {
        wrapProp(target as ViewModel<T>, target[i], i);
      }
    } else {
      const vmCore = newViewModelCore(target);
      const proxy = new Proxy(
        target as ViewModel,
        isPromise(target) ? PromiseProxyHandler : ObjectProxyHandler,
      );
      vmCore[PROXY] = proxy;
      for (const k in target) {
        if (isPublicProperty(k)) {
          wrapProp(target as ViewModel<T>, target[k], k);
        }
      }
    }
    return proxy;
  } else {
    return target;
  }
}

export function proxyAttributes<T extends object>(attributes: T) {
  if (!isObject(attributes)) throw new Error('attrs must be object');
  const p = (attributes as ViewModel<T>)[$$];
  if (p) return p[PROXY];
  // 初始化时默认的 notifiable 为 false，
  // 待 RENDER 结束后才修改为 true，用于避免无谓的消息通知。
  const vmCore = newViewModelCore(attributes, false);

  return (vmCore[PROXY] = new Proxy(attributes as ViewModel, {
    set: attrsPropSetHandler,
  }));
}

// function handleVMDebug(vm) {
//   if (!config[CFG_VM_DEBUG]) {
//     return;
//   }
//   let _di = window._VM_DEBUG;
//   if (!_di) {
//     _di = window._VM_DEBUG = {
//       id: 0, vms: []
//     };
//   }
//   vm[VM_DEBUG_ID] = _di.id++;
//   // if (isComponent(vm) && !(VM_DEBUG_NAME in vm)) {
//   //   vm[VM_DEBUG_NAME] = `<${vm.constructor.name}>`;
//   // }
//   _di.vms.push(vm);
// }

export function proxyComponent(component: Component) {
  // 初始化时 Component 默认的 VM_NOTIFIABLE 为 false，
  // 待 RENDER 结束后才修改为 true，用于避免无谓的消息通知。
  const vmCore = newViewModelCore(component, false);

  vmCore[PROXY] = new Proxy(component, {
    set: componentPropSetHandler,
  });
  return vmCore;
}

export function vm<T extends object>(target: T) {
  if (!isObject(target)) throw new Error('vm() only accept object');
  const p = (target as ViewModel)[$$];
  if (p) return p[PROXY];
  return wrapVm(target);
}

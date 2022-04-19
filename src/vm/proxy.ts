import { isNumber, isArray, isObject, isFunction, isPromise, isUndefined, warn } from '../util';
import {
  ViewModelObject,
  ViewModelWatchHandler,
  PropertyPathItem,
  addParent,
  isViewModel,
  removeParent,
  shiftParent,
  isPublicProperty,
  isInnerObj,
  ViewModelArray,
  $$,
} from './common';
import { ViewModelCoreImpl } from './core';

/**
 * check if property named "prop" is setter of instance "obj",
 * if it's setter, return setter function, otherwise return null.
 * @param {Object} obj
 * @param {String} prop
 *
 * 检测名称为 "prop" 的属性是否是 setter，如果是，返回该 setter 函数，
 * 否则，返回 null。
 * 由于 obj 可能是有继承关系的类的实例，因此需要向上检测继承的类的 prototype。
 */
function getSetterFnIfPropIsSetter(obj: ViewModelObject, prop: string | symbol): (v: unknown) => void {
  let map = obj[$$].__setters;
  if (!map) {
    obj[$$].__setters = map = new Map();
  }
  type Constructor = { prototype: unknown };
  if (!map.has(prop)) {
    let clazz: Constructor = obj.constructor as Constructor;
    let desc = Object.getOwnPropertyDescriptor(clazz.prototype, prop);
    let fn: (v: unknown) => void;
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

function notifyPropChanged(vm: ViewModelObject, prop: string | number): void {
  vm[$$].__notify(prop);
}

function __propSetHandler(
  target: ViewModelObject,
  prop: string | symbol,
  value: unknown,
  setFn: (target: ViewModelObject, prop: string | number, value: unknown) => void,
  assertVM = true,
): boolean {
  if (!isPublicProperty(prop)) {
    /**
     * 如果不强制转成 string，typescript 会报：Type 'symbol' cannot be used as an index type
     */
    target[prop as string] = value;
    return true;
  }
  const oldVal = target[prop as string];
  if (oldVal === value && !isUndefined(value)) {
    return true;
  }
  let newValIsVM = isObject(value) && !isInnerObj(value);
  if (newValIsVM) {
    newValIsVM = $$ in (value as Record<symbol, unknown>);
    if (assertVM && !newValIsVM) {
      throw new Error(`public property "${prop.toString()}" of ViewModel must also be ViewModel`);
    }
  }
  // console.log(`'${prop}' changed from ${store[prop]} to ${value}`);
  if (isObject(oldVal) && $$ in (oldVal as Record<symbol, unknown>)) {
    removeParent((oldVal as ViewModelObject)[$$], target[$$], prop as string);
  }
  setFn(target, prop as string, value);
  if (newValIsVM) {
    addParent((value as ViewModelObject)[$$], target[$$], prop as string);
  }
  notifyPropChanged(target, prop as string);
  return true;
}

function __objectPropSetFn(target: ViewModelObject, prop: string, value: unknown): void {
  target[prop] = value;
}

function __componentPropSetFn(target: ViewModelObject, prop: string, value: unknown): void {
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
    setterFn.call(target[$$].proxy, value);
  } else {
    target[prop] = value;
  }
}

function objectPropSetHandler(target: unknown, prop: string | symbol, value: unknown): boolean {
  if (!($$ in (target as Record<symbol, unknown>))) {
    // ViewModel has been destroied.
    return true;
  }
  return __propSetHandler(target as ViewModelObject, prop, value, __objectPropSetFn);
}

function attrsPropSetHandler(target: unknown, prop: string | symbol, value: unknown): boolean {
  if (!($$ in (target as Record<symbol, unknown>))) {
    // ViewModel has been destroied.
    return true;
  }
  return __propSetHandler(target as ViewModelObject, prop, value, __objectPropSetFn, false);
}

function componentPropSetHandler(target: unknown, prop: string | symbol, value: unknown): boolean {
  if (!($$ in (target as Record<symbol, unknown>))) {
    warn(
      `call setter "${prop.toString()}" after destroied, resources such as setInterval maybe not released before destroy. component:`,
      target,
    );
    return true;
  }
  return __propSetHandler(target as ViewModelObject, prop, value, __componentPropSetFn);
}

function arrayNotifyItems(target: ViewModelArray, idxStart: number, idxEnd: number): void {
  let i = idxStart;
  if (idxStart > idxEnd) {
    i = idxEnd;
    idxEnd = idxStart;
  }
  for (; i < idxEnd; i++) {
    // console.log('npc', i);
    notifyPropChanged(target, i);
  }
}

function arrayLengthSetHandler(target: ViewModelArray, value: number): boolean {
  if (!isNumber(value)) {
    throw new Error('bad argument. array length must be validate number.');
  }
  const oldLen = target.length;
  if (oldLen > value) {
    for (let i = value; i < oldLen; i++) {
      const v = target[i];
      if (isViewModel(v)) {
        removeParent(v[$$], target[$$], i);
      }
    }
  }
  target.length = value;
  // console.log('set .length from', oldLen, 'to', value);
  if (oldLen !== value) {
    notifyPropChanged(target, 'length');
    arrayNotifyItems(target, oldLen, value);
  }
  return true;
}

function arrayPropSetHandler(target: unknown, prop: string | symbol, value: unknown): boolean {
  if (!($$ in (target as Record<symbol, unknown>))) {
    return true;
  }
  if (prop === 'length') {
    return arrayLengthSetHandler(target as ViewModelArray, value as number);
  }
  /**
   * 即便是 arr[0] 这样的取值，在 Proxy 的 set 里面，传递的 property 也是 string 类型，即 "0"。
   * 因此，对数组也使用和对象一致的 objectPropSetHandler 来处理。
   */
  return __propSetHandler(target as ViewModelObject, prop, value, __objectPropSetFn);
}

const ObjectProxyHandler = {
  set: objectPropSetHandler,
};

const PromiseProxyHandler = {
  get(target: unknown, prop: string | symbol): unknown {
    if (prop === 'then' || prop === 'catch') {
      const v = (target as Record<string, (...args: unknown[]) => unknown>)[prop as string];
      return function (...args: unknown[]): unknown {
        return v.call(target, ...args);
      };
    } else {
      return (target as Record<string, unknown>)[prop as string];
    }
  },
  set: objectPropSetHandler,
};

function _arrayReverseSort(target: ViewModelArray, fn: string, arg?: (...args: unknown[]) => unknown): ViewModelArray {
  target.forEach((it, i) => {
    if (isViewModel(it)) {
      addParent((it as ViewModelObject)[$$], target[$$], i);
    }
  });
  (target as Record<string, (...args: unknown[]) => unknown>)[fn](arg);
  target.forEach((it, i) => {
    if (isViewModel(it)) {
      removeParent((it as ViewModelObject)[$$], target[$$], i);
    }
  });
  arrayNotifyItems(target as ViewModelArray, 0, target.length);
  // return wrapper proxy to ensure `arr.reverse() === arr`
  return target[$$].proxy as ViewModelArray;
}

function wrapSubArray(arr: ViewModelObject[], wrapEachItem = false): ViewModelArray {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  const rtn = wrapProxy(arr, true);
  // handleVMDebug(arr);
  arr.forEach((it, i) => {
    if (isViewModel(it)) {
      addParent(it[$$], (arr as ViewModelArray)[$$], i);
    } else if (wrapEachItem) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      arr[i] = createViewModel(it);
    }
  });
  return rtn as ViewModelArray;
}

function _arrayShiftOrUnshiftProp(arr: ViewModelArray, delta: number): void {
  arr.forEach((el, i) => {
    if (!isViewModel(el)) return;
    shiftParent(el[$$], arr[$$], i, delta);
  });
}

function _argAssert(arg: unknown, fn: string): boolean {
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
  splice(target: ViewModelArray, idx: number, delCount: number, ...args: ViewModelObject[]): ViewModelObject[] {
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
    const rtn = wrapSubArray(target.splice(idx, delCount, ...args));
    if (delta !== 0) {
      notifyPropChanged(target, 'length');
      for (let i = idx; i < target.length; i++) {
        notifyPropChanged(target, i);
      }
    }
    return rtn;
  },
  shift(target: ViewModelArray): ViewModelObject {
    if (target.length === 0) return target.shift();
    _arrayShiftOrUnshiftProp(target, -1);
    const el = target.shift();
    if (isViewModel(el)) {
      removeParent(el[$$], target[$$], -1);
    }
    notifyPropChanged(target, 'length');
    for (let i = 0; i < target.length + 1; i++) {
      notifyPropChanged(target, i);
    }
    return el;
  },
  unshift(target: ViewModelArray, ...args: ViewModelArray): number {
    if (args.length === 0) return target.unshift();
    args.forEach((arg, i) => {
      if (_argAssert(arg, 'unshift')) {
        addParent(arg[$$], target[$$], i);
      }
    });
    _arrayShiftOrUnshiftProp(target, args.length);
    const rtn = target.unshift(...args);
    notifyPropChanged(target, 'length');
    for (let i = 0; i < target.length; i++) {
      notifyPropChanged(target, i);
    }
    return rtn;
  },
  pop(target: ViewModelArray): ViewModelObject {
    if (target.length === 0) {
      return target.pop();
    }
    const el = target.pop();
    if (isViewModel(el)) {
      removeParent(el[$$], target[$$], target.length);
    }
    notifyPropChanged(target, 'length');
    notifyPropChanged(target, target.length);
    return el;
  },
  push(target: ViewModelArray, ...args: ViewModelArray): number {
    if (args.length === 0) return 0;
    args.forEach((arg, i) => {
      if (_argAssert(arg, 'push')) {
        addParent(arg[$$], target[$$], target.length + i);
      }
    });
    const rtn = target.push(...args);
    notifyPropChanged(target, 'length');
    for (let i = target.length - args.length; i < target.length; i++) {
      notifyPropChanged(target, i);
    }
    return rtn;
  },
  fill(target: ViewModelArray, v: ViewModelObject): ViewModelArray {
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
      notifyPropChanged(target, i);
    });
    return target[$$].proxy as ViewModelArray;
  },
  reverse(target: ViewModelArray): ViewModelArray {
    return _arrayReverseSort(target, 'reverse');
  },
  sort(target: ViewModelArray, fn: (...args: unknown[]) => unknown): ViewModelArray {
    return _arrayReverseSort(target, 'sort', fn);
  },
  concat(target: ViewModelArray, arr: ViewModelArray): ViewModelArray {
    _argAssert(arr, 'concat');
    return wrapSubArray(target.concat(arr));
  },
  filter(target: ViewModelArray, fn: (it: ViewModelObject, idx: number) => boolean): ViewModelArray {
    return wrapSubArray(target.filter(fn));
  },
  slice(target: ViewModelArray, si: number, ei: number): ViewModelArray {
    return wrapSubArray(target.slice(si, ei));
  },
  map(target: ViewModelArray, fn: (it: ViewModelObject, idx: number) => ViewModelObject): ViewModelArray {
    return wrapSubArray(target.map(fn), true);
  },
};

const ArrayProxyHandler = {
  get(target: unknown[], prop: string | number | symbol): unknown {
    if (prop in ArrayFns) {
      const fn = (ArrayFns as Record<string, (...args: unknown[]) => unknown>)[prop as string];
      return function (...args: unknown[]): unknown {
        return fn(target, ...args);
      };
    } else {
      return target[prop as number];
    }
  },
  set: arrayPropSetHandler,
};

function wrapProxy(target: unknown, isArr: boolean): unknown {
  const vmCore = new ViewModelCoreImpl(target);
  // eslint-disable-next-line @typescript-eslint/ban-types
  return (vmCore.proxy = new Proxy(
    target as object,
    isArr ? ArrayProxyHandler : isPromise(target) ? PromiseProxyHandler : ObjectProxyHandler,
  ));
}

function wrapProp(parent: ViewModelObject, child: ViewModelObject, property: string | number): void {
  // const v = vm[property];
  if (!isObject(child) || isInnerObj(child)) {
    return;
  }
  if (!($$ in child)) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    parent[property] = child = createViewModel(child);
  }
  addParent(child[$$], parent[$$], property);
}

/**
 * @internal
 */
export function createViewModel<T>(target: T): T & ViewModelObject {
  if (isObject(target)) {
    // directly return if alreay is ViewModel or inner object(Date/RegExp/Boolean).
    if (isInnerObj(target) || $$ in target) {
      return target as T & ViewModelObject;
    }

    const isArr = isArray(target);
    const rtn = wrapProxy(target, isArr) as T & ViewModelObject;
    if (isArr) {
      for (let i = 0; i < (target as unknown as ViewModelObject[]).length; i++) {
        wrapProp(target as unknown as ViewModelObject, (target as unknown as ViewModelObject[])[i], i);
      }
    } else {
      for (const k in target) {
        if (isPublicProperty(k)) {
          wrapProp(target as unknown as ViewModelObject, (target as unknown as Record<string, ViewModelObject>)[k], k);
        }
      }
    }
    return rtn;
  } else {
    return target as T & ViewModelObject;
  }
}

/**
 * @internal
 */
export function createAttributes<T>(attributes: T): T & ViewModelObject {
  const vmCore = new ViewModelCoreImpl(attributes);
  // 初始化时默认的 notifiable 为 false，
  // 待 RENDER 结束后才修改为 true，用于避免无谓的消息通知。
  vmCore.__notifiable = false;
  // eslint-disable-next-line @typescript-eslint/ban-types
  return (vmCore.proxy = new Proxy(attributes as unknown as object, {
    set: attrsPropSetHandler,
  })) as T & ViewModelObject;
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

/**
 * @internal
 */
export function createComponent<T>(component: T): T {
  if ($$ in component) {
    throw new Error('component has alreay been wrapped.');
  }
  // handleVMDebug(component);
  const vmCore = new ViewModelCoreImpl(component);
  // 初始化时 Component 默认的 VM_NOTIFIABLE 为 false，
  // 待 RENDER 结束后才修改为 true，用于避免无谓的消息通知。
  vmCore.__notifiable = false;
  // eslint-disable-next-line @typescript-eslint/ban-types
  return (vmCore.proxy = new Proxy(component as unknown as object, {
    set: componentPropSetHandler,
  }) as unknown as T);
}

export function vm<T>(target: T): T & ViewModelObject {
  if (!isObject(target)) {
    throw new Error('vm() target must be object or array.');
  }
  return createViewModel<T>(target);
}

export function watch(vm: ViewModelObject, property: PropertyPathItem, handler: ViewModelWatchHandler): void;
export function watch(vm: ViewModelObject, propertyStringPath: string, handler: ViewModelWatchHandler): void;
export function watch(vm: ViewModelObject, propertyArrayPath: PropertyPathItem[], handler: ViewModelWatchHandler): void;
export function watch(
  vm: ViewModelObject,
  propertyPath?: string | PropertyPathItem | PropertyPathItem[],
  handler?: ViewModelWatchHandler,
): void {
  vm[$$].__watch(propertyPath, handler);
}

export function unwatch(vm: ViewModelObject): void;
export function unwatch(vm: ViewModelObject, property: PropertyPathItem, handler?: ViewModelWatchHandler): void;
export function unwatch(vm: ViewModelObject, propertyStringPath: string, handler?: ViewModelWatchHandler): void;
export function unwatch(
  vm: ViewModelObject,
  propertyArrayPath: PropertyPathItem[],
  handler?: ViewModelWatchHandler,
): void;
export function unwatch(
  vm: ViewModelObject,
  propertyPath?: string | PropertyPathItem | PropertyPathItem[],
  handler?: ViewModelWatchHandler,
): void {
  vm[$$].__unwatch(propertyPath, handler);
}

import {
  typeOf,
  instanceOf,
  Symbol,
  isNumber,
  isArray,
  isObject,
  assertFail,
  STR_LENGTH,
  isFunction,
  isPromise
} from '../util';
import {
  VM_PARENTS,
  isViewModel,
  isPublicProp,
  addVMParent,
  removeVMParent,
  VM_DEBUG_ID,
  VM_DESTROIED
} from './common';
import {
  VM_NOTIFY,
  vmAddMessengerInterface,
  VM_LISTENERS
} from './notify';
import {
  CFG_VM_DEBUG,
  config
} from '../config';

export const VM_WRAPPER_PROXY = Symbol('proxy');
export const VM_SETTER_FN_MAP = Symbol('is_setter_fn_map');

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
function getSetterFnIfPropIsSetter(obj, prop) {
  let map = obj[VM_SETTER_FN_MAP];
  if (map === null) {
    /**
     * use cache to store setter functions.
     * 缓存曾经检测过的属性名，提升性能。
     */
    map = obj[VM_SETTER_FN_MAP] = new Map();
  }
  if (!map.has(prop)) {
    let clazz = obj.constructor;
    let desc = Object.getOwnPropertyDescriptor(clazz.prototype, prop);
    let fn;
    if (desc) {
      fn = isFunction(desc.set) ? desc.set : null;
      map.set(prop, fn);
      return fn;
    }
    // lookup to check parent classes
    clazz = Object.getPrototypeOf(clazz);
    while (clazz && clazz.prototype) {
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

function notifyPropChanged(vm, prop) {
  if (vm[VM_DESTROIED]) {
    return;
  }
  if (VM_NOTIFY in vm) {
    vm[VM_NOTIFY](prop);
  }
  vm[VM_PARENTS].forEach(pInfo => {
    const [pVM, pName] = pInfo;
    notifyPropChanged(
      pVM,
      isArray(prop) ? [pName, ...prop] : [pName, prop]
    );
  });
}

function objectPropSetHandler(target, prop, value) {
  if (!isPublicProp(prop)) {
    target[prop] = value;
    return true;
  }
  const newValType = typeOf(value);
  const newValIsVM = isViewModel(value);
  if (value !== null && newValType === 'object' && !newValIsVM) {
    throw new Error('public property of ViewModel target must also be ViewModel');
  }
  // console.log(`'${prop}' changed from ${store[prop]} to ${value}`);
  const oldVal = target[prop];
  if (isViewModel(oldVal)) {
    removeVMParent(oldVal, target, prop);
  }
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
    setterFn.call(target[VM_WRAPPER_PROXY], value);
  } else {
    target[prop] = value;
  }

  if (newValIsVM) {
    addVMParent(value, target, prop);
  }
  notifyPropChanged(target, prop);
  return true;
}

function arrayPropSetHandler(target, prop, value) {
  if (prop === STR_LENGTH) {
    return arrayLengthSetHandler(target, value);
  }
  console.log('set', prop);
  return objectPropSetHandler(target, prop, value);
}

function arrayNotifyItems(target, idxStart, idxEnd) {
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

function arrayLengthSetHandler(target, value) {
  if (!isNumber(value)) throw new Error('bad argument. array length must be validate number.');
  const oldLen = target.length;
  if (oldLen > value) {
    for (let i = value; i < oldLen; i++) {
      const v = target[i];
      isViewModel(v) && removeVMParent(v, target, i);
    }
  }
  target.length = value;
  // console.log('set .length from', oldLen, 'to', value);
  if (oldLen !== value) {
    notifyPropChanged(target, STR_LENGTH);
    arrayNotifyItems(target, oldLen, value);
  }
  return true;
}

export const ObjectProxyHandler = {
  set: objectPropSetHandler
};

export const PromiseProxyHandler = {
  get(target, prop) {
    if (prop === 'then' || prop === 'catch') {
      const v = target[prop];
      return function(...args) {
        return v.call(target, ...args);
      };
    } else {
      return target[prop];
    }
  },
  set: objectPropSetHandler
};

function _arrayFillReverseSort(target, fn, arg) {
  target.forEach((it, i) => {
    if (isViewModel(it)) {
      removeVMParent(it, target, i);
    }
  });
  target[fn](arg);
  target.forEach((it, i) => {
    if (isViewModel(it)) {
      addVMParent(it, target, i);
    }
  });
  arrayNotifyItems(target, 0, target.length);
  // return wrapper proxy to ensure `arr.reverse() === arr`
  return target[VM_WRAPPER_PROXY];
}

function _arrayWrapSub(arr, wrapEachItem = false) {
  const rtn = wrapProxy(arr, true);
  handleVMDebug(arr);
  arr.forEach((it, i) => {
    if (isViewModel(it)) {
      addVMParent(it, arr, i);
    } else if (wrapEachItem) {
      arr[i] = loopWrapVM(it);
    }
  });
  return rtn;
}

function _arrayShiftOrUnshiftProp(arr, delta) {
  arr.forEach((el, i) => {
    if (!isViewModel(el)) return;
    const ps = el[VM_PARENTS];
    const pe = ps.find(pp => pp[0] === arr && pp[1] === i);
    if (pe) {
      pe[1] += delta;
    }
  });
}

function _argAssert(arg, fn) {
  if (arg !== null && isObject(arg)) {
    if (!(VM_PARENTS in arg)) {
      throw new Error(`argument passed to Array.${fn} must be ViewModel if the array is ViewModel`);
    } else {
      return true;
    }
  } else {
    return false;
  }
}

const ArrayFns = {
  splice(target, idx, delCount, ...args) {
    if (idx < 0) idx = 0;
    args.forEach((arg, i) => {
      if (_argAssert(arg, 'splice')) {
        addVMParent(arg, target, idx + i);
      }
    });
    for (let i = 0; i < delCount; i++) {
      if (idx + i >= target.length) break;
      const el = target[idx + i];
      if (isViewModel(el)) {
        removeVMParent(el, target, idx + i);
      }
    }
    const delta = args.length - delCount;
    if (delta !== 0) {
      for (let i = idx + delCount; i < target.length; i++) {
        const el = target[i];
        if (!isViewModel(el)) continue;
        const ps = el[VM_PARENTS];
        const pe = ps.find(pp => pp[0] === target && pp[1] === i);
        if (pe) {
          pe[1] += delta;
        }
      }
    }
    const rtn = _arrayWrapSub(target.splice(idx, delCount, ...args));
    if (delta !== 0) {
      notifyPropChanged(target, STR_LENGTH);
      for (let i = idx; i < target.length; i++) {
        notifyPropChanged(target, i);
      }
    }
    return rtn;
  },
  shift(target) {
    if (target.length === 0) return target.shift();
    _arrayShiftOrUnshiftProp(target, -1);
    const el = target.shift();
    if (isViewModel(el)) {
      removeVMParent(el, target, -1);
    }
    notifyPropChanged(target, STR_LENGTH);
    for (let i = 0; i < target.length + 1; i++) {
      notifyPropChanged(target, i);
    }
    return el;
  },
  unshift(target, ...args) {
    if (args.length === 0) return target.unshift();
    args.forEach((arg, i) => {
      if (_argAssert(arg, 'unshift')) {
        addVMParent(arg, target, i);
      }
    });
    _arrayShiftOrUnshiftProp(target, args.length);
    const rtn = target.unshift(...args);
    notifyPropChanged(target, STR_LENGTH);
    for (let i = 0; i < target.length; i++) {
      notifyPropChanged(target, i);
    }
    return rtn;
  },
  pop(target) {
    if (target.length === 0) {
      return target.pop();
    }
    const el = target.pop();
    if (isViewModel(el)) {
      removeVMParent(el, target, target.length);
    }
    notifyPropChanged(target, STR_LENGTH);
    notifyPropChanged(target, target.length);
    return el;
  },
  push(target, ...args) {
    if (args.length === 0) return target.push();
    args.forEach((arg, i) => {
      if (_argAssert(arg, 'push')) {
        addVMParent(arg, target, target.length + i);
      }
    });
    const rtn = target.push(...args);
    notifyPropChanged(target, STR_LENGTH);
    for (let i = target.length - 1 - args.length; i < target.length; i++) {
      notifyPropChanged(target, i);
    }
    return rtn;
  },
  fill(target, v) {
    _argAssert(v, 'fill');
    return _arrayFillReverseSort(target, 'fill', v);
  },
  reverse(target) {
    return _arrayFillReverseSort(target, 'reverse');
  },
  sort(target, fn) {
    return _arrayFillReverseSort(target, 'sort', fn);
  },
  concat(target, arr) {
    _argAssert(arr, 'concat');
    return _arrayWrapSub(target.concat(arr));
  },
  filter(target, fn) {
    return _arrayWrapSub(target.filter(fn));
  },
  slice(target, si, ei) {
    return _arrayWrapSub(target.slice(si, ei));
  },
  map(target, fn) {
    return _arrayWrapSub(target.map(fn), true);
  }
};

export const ArrayProxyHandler = {
  get(target, prop) {
    if (prop in ArrayFns) {
      const fn = ArrayFns[prop];
      return function(...args) {
        return fn(target, ...args);
      };
    } else {
      return target[prop];
    }
  },
  set: arrayPropSetHandler
};

function isInnerObj(v) {
  return instanceOf(v, Boolean) || instanceOf(v, RegExp) || instanceOf(v, Date);
}
function wrapProp(vm, prop) {
  const v = vm[prop];
  if (v === null || !isObject(v)) return;
  if (VM_PARENTS in v) {
    addVMParent(v, vm, prop);
    return;
  }
  if (isInnerObj(v)) {
    v[VM_PARENTS] = [];
    v[VM_DESTROIED] = false;
    v[VM_SETTER_FN_MAP] = null;
    return;
  }
  vm[prop] = loopWrapVM(v);
  addVMParent(v, vm, prop);
}

function wrapProxy(vm, isArr) {
  vm[VM_PARENTS] = [];
  vm[VM_DESTROIED] = false;
  vm[VM_SETTER_FN_MAP] = null;
  const p = new Proxy(vm, isArr ? ArrayProxyHandler : (
    isPromise(vm) ? PromiseProxyHandler : ObjectProxyHandler
  ));
  vm[VM_WRAPPER_PROXY] = p;
  return p;
}

function loopWrapVM(plainObjectOrArray) {
  if (plainObjectOrArray === null) return plainObjectOrArray;
  if (isObject(plainObjectOrArray)) {
    // already been ViewModel
    if (VM_PARENTS in plainObjectOrArray) return plainObjectOrArray;
    if (isInnerObj(plainObjectOrArray)) {
      plainObjectOrArray[VM_PARENTS] = [];
      plainObjectOrArray[VM_DESTROIED] = false;
      plainObjectOrArray[VM_SETTER_FN_MAP] = null;
      return plainObjectOrArray;
    } else if (isArray(plainObjectOrArray)) {
      for (let i = 0; i < plainObjectOrArray.length; i++) {
        wrapProp(plainObjectOrArray, i);
      }
      return wrapProxy(plainObjectOrArray, true);
    } else {
      for (const k in plainObjectOrArray) {
        if (isPublicProp(k)) {
          wrapProp(plainObjectOrArray, k);
        }
      }
      return wrapProxy(plainObjectOrArray, false);
    }
  } else {
    return plainObjectOrArray;
  }
}

export function wrapViewModel(plainObjectOrArray, addMessengerInterface = false) {
  const vm = loopWrapVM(plainObjectOrArray);
  if (vm !== plainObjectOrArray) {
    if (addMessengerInterface) {
      vmAddMessengerInterface(plainObjectOrArray);
    }
    handleVMDebug(plainObjectOrArray);
  }
  return vm;
}

function handleVMDebug(vm) {
  if (!config[CFG_VM_DEBUG]) return;
  let _di = window._VM_DEBUG;
  if (!_di) {
    _di = window._VM_DEBUG = {
      id: 0, vms: []
    };
  }
  vm[VM_DEBUG_ID] = _di.id++;
  // if (isComponent(vm) && !(VM_DEBUG_NAME in vm)) {
  //   vm[VM_DEBUG_NAME] = `<${vm.constructor.name}>`;
  // }
  _di.vms.push(vm);
}

export function wrapComponent(component) {
  if (component[VM_PARENTS]) {
    console.error('dulplicated wrap component', component);
    return;
  }
  component[VM_PARENTS] = [];
  component[VM_DESTROIED] = false;
  component[VM_SETTER_FN_MAP] = null;
  component[VM_LISTENERS] = new Map();
  handleVMDebug(component);
  const p = new Proxy(component, ObjectProxyHandler);
  component[VM_WRAPPER_PROXY] = p;
  return p;
}

/**
 * @notice Don't use this function. It can only be used for compiler generated code.
 * @param {Compiler Generated Attrs Object} attrsObj
 */
export function wrapAttrs(attrsObj) {
  if (attrsObj === null || !isObject(attrsObj) || (VM_PARENTS in attrsObj)) {
    /*
     * this should never happen,
     * as `wrapAttrs` should only be used in compiler generated code.
     */
    assertFail();
  }
  for (const k in attrsObj) {
    if (isPublicProp(k)) {
      const v = attrsObj[k];
      if (v !== null && isObject(v) && !(VM_PARENTS in v)) {
        throw new Error(`value passed to attribute "${k}" must be ViewModel.`);
      }
    }
  }
  return wrapViewModel(attrsObj, true);
}

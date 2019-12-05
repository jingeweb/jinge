import {
  Symbol,
  isNumber,
  isArray,
  isObject,
  STR_LENGTH,
  isFunction,
  isPromise,
  isUndefined,
  getOrCreateMapProperty,
  assertFail
} from '../util';
import {
  isInnerObj,
  isPublicProp,
  ViewModelAttrs,
  VM_ATTRS,
  VM_PROXY,
  VM_NOTIFY,
  VM_NOTIFIABLE,
  isViewModel,
  VM_ADD_PARENT,
  VM_REMOVE_PARENT,
  VM_SHIFT_PARENT
} from './core';

export const VM_SETTER_FN_MAP = Symbol('vm_setter_fn_map');

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
  const map = getOrCreateMapProperty(obj, VM_SETTER_FN_MAP);
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
  vm[VM_ATTRS][VM_NOTIFY](prop);
}

function __propSetHandler(target, prop, value, setFn, assertVM = true) {
  if (!isPublicProp(prop)) {
    target[prop] = value;
    return true;
  }
  const oldVal = target[prop];
  if (oldVal === value && !isUndefined(value)) {
    return true;
  }
  let newValIsVM = isObject(value) && !isInnerObj(value);
  if (newValIsVM) {
    newValIsVM = VM_ATTRS in value;
    if (assertVM && !newValIsVM) {
      throw new Error(`public property "${prop}" of ViewModel must also be ViewModel`);
    }
  }
  // console.log(`'${prop}' changed from ${store[prop]} to ${value}`);
  if (isObject(oldVal)) {
    const a = oldVal[VM_ATTRS];
    a && a[VM_REMOVE_PARENT](target, prop);
  }
  setFn(target, prop, value);
  if (newValIsVM) {
    value[VM_ATTRS][VM_ADD_PARENT](target, prop);
  }
  notifyPropChanged(target, prop);
  return true;
}

function __objectPropSetFn(target, prop, value) {
  target[prop] = value;
}

function __componentPropSetFn(target, prop, value) {
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
    setterFn.call(target[VM_ATTRS][VM_PROXY], value);
  } else {
    target[prop] = value;
  }
}

function objectPropSetHandler(target, prop, value) {
  if (!target[VM_ATTRS]) {
    // ViewModel has been destroied.
    return true;
  }
  return __propSetHandler(target, prop, value, __objectPropSetFn);
}

function attrsPropSetHandler(target, prop, value) {
  if (!target[VM_ATTRS]) {
    // ViewModel has been destroied.
    return true;
  }
  return __propSetHandler(target, prop, value, __objectPropSetFn, false);
}

function componentPropSetHandler(target, prop, value) {
  if (!target[VM_ATTRS]) {
    console.warn(`call setter "${prop.toString()}" after destroied, resources such as setInterval maybe not released before destroy. component:`, target);
    return true;
  }
  return __propSetHandler(target, prop, value, __componentPropSetFn);
}

function arrayPropSetHandler(target, prop, value) {
  if (prop === STR_LENGTH) {
    return arrayLengthSetHandler(target, value);
  }
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
      isViewModel(v) && v[VM_ATTRS][VM_REMOVE_PARENT](target, i);
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

const ObjectProxyHandler = {
  set: objectPropSetHandler
};

const PromiseProxyHandler = {
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

function _arrayFill(target, v) {
  target.forEach((it, i) => {
    if (it === v && !isUndefined(it)) {
      return;
    }
    if (isViewModel(it)) {
      it[VM_ATTRS][VM_REMOVE_PARENT](target, i);
    }
    target[i] = v;
    if (isViewModel(it)) {
      it[VM_ATTRS][VM_ADD_PARENT](target, i);
    }
    notifyPropChanged(target, i);
  });
  return target[VM_ATTRS][VM_PROXY];
}

function _arrayReverseSort(target, fn, arg) {
  target.forEach((it, i) => {
    if (isViewModel(it)) {
      it[VM_ATTRS][VM_ADD_PARENT](target, i);
    }
  });
  target[fn](arg);
  target.forEach((it, i) => {
    if (isViewModel(it)) {
      it[VM_ATTRS][VM_REMOVE_PARENT](parent, i);
    }
  });
  arrayNotifyItems(target, 0, target.length);
  // return wrapper proxy to ensure `arr.reverse() === arr`
  return target[VM_ATTRS][VM_PROXY];
}

function _arrayWrapSub(arr, wrapEachItem = false) {
  const rtn = wrapProxy(arr, true);
  // handleVMDebug(arr);
  arr.forEach((it, i) => {
    if (isViewModel(it)) {
      it[VM_ATTRS][VM_ADD_PARENT](arr, i);
    } else if (wrapEachItem) {
      arr[i] = loopWrapVM(it);
    }
  });
  return rtn;
}

function _arrayShiftOrUnshiftProp(arr, delta) {
  arr.forEach((el, i) => {
    if (!isViewModel(el)) return;
    el[VM_ATTRS][VM_SHIFT_PARENT](arr, i, delta);
  });
}

function _argAssert(arg, fn) {
  if (isObject(arg)) {
    if (!(VM_ATTRS in arg)) {
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
        arg[VM_ATTRS][VM_ADD_PARENT](target, idx + i);
      }
    });
    for (let i = 0; i < delCount; i++) {
      if (idx + i >= target.length) break;
      const el = target[idx + i];
      if (isViewModel(el)) {
        el[VM_ATTRS][VM_REMOVE_PARENT](target, idx + i);
      }
    }
    const delta = args.length - delCount;
    if (delta !== 0) {
      for (let i = idx + delCount; i < target.length; i++) {
        const el = target[i];
        if (!isViewModel(el)) continue;
        el[VM_ATTRS][VM_SHIFT_PARENT](target, i, delta);
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
      el[VM_ATTRS][VM_REMOVE_PARENT](target, -1);
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
        arg[VM_ATTRS][VM_ADD_PARENT](target, i);
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
      el[VM_ATTRS][VM_REMOVE_PARENT](target, target.length);
    }
    notifyPropChanged(target, STR_LENGTH);
    notifyPropChanged(target, target.length);
    return el;
  },
  push(target, ...args) {
    if (args.length === 0) return target.push();
    args.forEach((arg, i) => {
      if (_argAssert(arg, 'push')) {
        arg[VM_ATTRS][VM_ADD_PARENT](target, target.length + i);
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
    return _arrayFill(target, v);
  },
  reverse(target) {
    return _arrayReverseSort(target, 'reverse');
  },
  sort(target, fn) {
    return _arrayReverseSort(target, 'sort', fn);
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

const ArrayProxyHandler = {
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

function wrapProp(vm, prop) {
  const v = vm[prop];
  if (!isObject(v) || isInnerObj(v)) {
    return;
  }
  if (VM_ATTRS in v) {
    v[VM_ATTRS][VM_ADD_PARENT](vm, prop);
    return;
  }
  vm[prop] = loopWrapVM(v);
  v[VM_ATTRS][VM_ADD_PARENT](vm, prop);
}

function wrapProxy(vm, isArr) {
  const vmAttrs = new ViewModelAttrs(vm);
  vm[VM_ATTRS] = vmAttrs;
  const p = new Proxy(vm, isArr ? ArrayProxyHandler : (
    isPromise(vm) ? PromiseProxyHandler : ObjectProxyHandler
  ));
  vmAttrs[VM_PROXY] = p;
  return p;
}

function loopWrapVM(plainObjectOrArray) {
  if (isObject(plainObjectOrArray)) {
    // directly return if alreay is ViewModel or inner object(Date/RegExp/Boolean).
    if (isInnerObj(plainObjectOrArray) || (VM_ATTRS in plainObjectOrArray)) {
      return plainObjectOrArray;
    }

    if (isArray(plainObjectOrArray)) {
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

export function wrapViewModel(plainObjectOrArray) {
  const vm = loopWrapVM(plainObjectOrArray);
  // if (vm !== plainObjectOrArray) {
  //   handleVMDebug(plainObjectOrArray);
  // }
  return vm;
}

// alias for convenient
export const VM = wrapViewModel;

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

export function wrapComponent(component) {
  if (component[VM_ATTRS]) {
    throw new Error('alreay wraped.');
  }
  // handleVMDebug(component);
  const vmAttrs = new ViewModelAttrs(component);
  // 初始化时 Component 默认的 VM_NOTIFIABLE 为 false，
  // 待 RENDER 结束后才修改为 true，用于避免无谓的消息通知。
  vmAttrs[VM_NOTIFIABLE] = false;
  component[VM_ATTRS] = vmAttrs;
  const p = new Proxy(component, {
    set: componentPropSetHandler
  });
  vmAttrs[VM_PROXY] = p;
  return p;
}

export function wrapAttrs(attrsObj) {
  if (!isObject(attrsObj)) {
    assertFail();
  }
  const vmAttrs = new ViewModelAttrs(attrsObj);
  // 初始化时 Attrs 默认的 VM_NOTIFIABLE 为 false，
  // 待 RENDER 结束后才修改为 true，用于避免无谓的消息通知。
  vmAttrs[VM_NOTIFIABLE] = false;
  attrsObj[VM_ATTRS] = vmAttrs;
  const attrs = new Proxy(attrsObj, {
    set: attrsPropSetHandler
  });
  vmAttrs[VM_PROXY] = attrs;
  return attrs;
}

import {
  typeOf,
  instanceOf,
  Symbol,
  isNumber,
  isArray,
  isObject,
  config,
  assert_fail,
  STR_LENGTH
} from '../util';
import {
  VM_PARENTS,
  VM_EMPTY_PARENTS,
  isViewModel,
  isPublicProp,
  addVMParent,
  removeVMParent,
  VM_DEBUG_ID
} from './common';
import {
  VM_NOTIFY,
  vmAddMessengerInterface,
  VM_LISTENERS
} from './notify';

export const VM_WRAPPER_PROXY = Symbol('proxy');

function notifyPropChanged(vm, prop) {
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
  target[prop] = value;
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
  for(; i < idxEnd; i++) {
    // console.log('npc', i);
    notifyPropChanged(target, i);
  }
}


function arrayLengthSetHandler(target, value) {
  if (!isNumber(value)) throw new Error('bad argument. array length must be validate number.');
  const oldLen = target.length;
  if (oldLen > value) for(let i = value; i < oldLen; i++) {
    const v = target[i];
    isViewModel(v) && removeVMParent(v, target, i);
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

function array_fill_reverse_sort(target, fn, arg) {
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

function _array_wrap_sub(arr) {
  const rtn = wrapProxy(arr, true);
  handleVMDebug(arr);
  arr.forEach((it, i) => {
    if (isViewModel(it)) {
      addVMParent(it, arr, i);
    }
  });
  return rtn;
}

function _array_shift_unshift_prop(arr, delta) {
  arr.forEach((el, i) => {
    if (!isViewModel(el)) return;
    const ps = el[VM_PARENTS];
    const pe = ps.find(pp => pp[0] === arr && pp[1] === i);
    if (pe) {
      pe[1] += delta;
    }
  });
}

function _arg_asert(arg, fn) {
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
      if (_arg_asert(arg, 'splice')) {
        addVMParent(arg, target, idx + i);
      }
    });
    for(let i = 0; i < delCount; i++) {
      if (idx + i >= target.length) break;
      const el = target[idx + i];
      if (isViewModel(el)) {
        removeVMParent(el, target, idx + i);
      }
    }
    const delta = args.length - delCount;
    if (delta !== 0) {
      for(let i = idx + delCount; i < target.length; i++) {
        const el = target[i];
        if (!isViewModel(el)) continue;
        const ps = el[VM_PARENTS];
        const pe = ps.find(pp => pp[0] === target && pp[1] === i);
        if (pe) {
          pe[1] += delta;
        }
      }
    }
    const rtn = _array_wrap_sub(target.splice(idx, delCount, ...args));
    if (delta !== 0) {
      notifyPropChanged(target, STR_LENGTH);
      for(let i = idx; i < target.length; i++) {
        notifyPropChanged(target, i);
      }
    }
    return rtn;
  },
  shift(target) {
    if (target.length === 0) return target.shift();
    _array_shift_unshift_prop(target, -1);
    const el = target.shift();
    if (isViewModel(el)) {
      removeVMParent(el, target, -1);
    }
    notifyPropChanged(target, STR_LENGTH);
    for(let i = 0; i < target.length + 1; i++) {
      notifyPropChanged(target, i);
    }
    return el;
  },
  unshift(target, ...args) {
    if (args.length === 0) return target.unshift();
    args.forEach((arg, i) => {
      if (_arg_asert(arg, 'unshift')) {
        addVMParent(arg, target, i);
      }
    });
    _array_shift_unshift_prop(target, args.length);
    const rtn = target.unshift(...args);
    notifyPropChanged(target, STR_LENGTH);
    for(let i = 0; i < target.length; i++) {
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
      if (_arg_asert(arg, 'push')) {
        addVMParent(arg, target, target.length + i);
      }
    });
    const rtn = target.push(...args);
    notifyPropChanged(target, STR_LENGTH);
    for(let i = target.length - 1 - args.length; i < target.length; i++) {
      notifyPropChanged(target, i);
    }
    return rtn;
  },
  fill(target, v) {
    _arg_asert(v, 'fill');
    return array_fill_reverse_sort(target, 'fill', v);
  },
  reverse(target) {
    return array_fill_reverse_sort(target, 'reverse');
  },
  sort(target, fn) {
    return array_fill_reverse_sort(target, 'sort', fn);
  },
  concat(target, arr) {
    _arg_asert(arr, 'concat');
    return _array_wrap_sub(target.concat(arr));
  },
  filter(target, fn) {
    return _array_wrap_sub(target.filter(fn));
  },
  slice(target, si, ei) {
    return _array_wrap_sub(target.slice(si, ei));
  },
  map(target, fn) {
    return _array_wrap_sub(target.map(fn));
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


function wrapProp(vm, prop) {
  const v = vm[prop];
  if (v === null || !isObject(v)) return;
  if (VM_PARENTS in v) {
    addVMParent(v, vm, prop);
    return;
  }
  if (instanceOf(v, Boolean) || instanceOf(v, RegExp)) {
    v[VM_PARENTS] = VM_EMPTY_PARENTS;
    return;
  }
  vm[prop] = loopWrapVM(v);
  addVMParent(v, vm, prop);
}

function wrapProxy(vm, isArr) {
  vm[VM_PARENTS] = [];
  const p = new Proxy(vm, isArr ? ArrayProxyHandler : ObjectProxyHandler);
  /**
   * as Array.sort/reverse/fill must return itself,
   * we must store the wrapper proxy into array,
   * and return this proxy when those functions are called.
   * 
   * Array.sort/reverse/fill 函数的返回值是其本身，即： arr.reverse() === arr；
   * 但如果 arr 是一个 proxy，则需要返回该 proxy 才能保证 `===` 成立。
   * 此处将 Proxy 反向存储下来，以便在这些函数被调用时可以返回。
   */
  if (isArr) vm[VM_WRAPPER_PROXY] = p;
  return p;
}

function loopWrapVM(plainObjectOrArray) {
  if (plainObjectOrArray === null) return plainObjectOrArray;
  if (isObject(plainObjectOrArray)) {
    // already been ViewModel
    if (VM_PARENTS in plainObjectOrArray) return plainObjectOrArray;
    if (instanceOf(plainObjectOrArray, Boolean) || instanceOf(plainObjectOrArray, RegExp)) {
      plainObjectOrArray[VM_PARENTS] = VM_EMPTY_PARENTS;
      return plainObjectOrArray;
    } else if (isArray(plainObjectOrArray)) {
      for(let i = 0; i < plainObjectOrArray.length; i++) {
        wrapProp(plainObjectOrArray, i);
      }
      return wrapProxy(plainObjectOrArray, true);
    } else {
      for(const k in plainObjectOrArray) {
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
  if (!config.vmDebug) return;
  let _di = window._VM_DEBUG;
  if (!_di) _di = window._VM_DEBUG = {id: 0, vms: []};
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
  component[VM_PARENTS] = VM_EMPTY_PARENTS;
  component[VM_LISTENERS] = new Map();
  handleVMDebug(component);
  return new Proxy(component, ObjectProxyHandler);
}

// const AttrsProxyHandler = {
//   set: function (target, prop, value) {
//     if (!isPublicProp(prop)) {
//       target[prop] = value;
//       return true;
//     }
//     target[prop] = value;
//     notifyPropChanged(target, prop);
//     return true;
//   }
// };

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
    assert_fail();
  }
  for(const k in attrsObj) {
    if (isPublicProp(k)) {
      const v = attrsObj[k];
      if (v !== null && isObject(v) && !(VM_PARENTS in v)) {
        throw new Error(`value passed to attribute "${k}" must be ViewModel.`);
      }
    }
  }
  return wrapViewModel(attrsObj, true);
  
  // attrsObj[VM_PARENTS] = VM_EMPTY_PARENTS;
  // vmAddMessengerInterface(attrsObj);
  // handleVMDebug(attrsObj);
  // return new Proxy(attrsObj, AttrsProxyHandler);
}
import {
  typeOf,
  instanceOf,
  isNumber,
  isArray,
  isObject
} from '../util';
import {
  VM_PARENTS,
  VM_EMPTY_PARENTS,
  isViewModel,
  isPublicProp,
  addVMParent,
  removeVMParent
} from './common';
import {
  VM_NOTIFY,
  vmAddMessengerInterface
} from './notify';
import {
  isComponent
} from '../core/component';

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
  if (prop === 'length') {
    return arrayLengthSetHandler(target, value);
  }
  return objectPropSetHandler(target, prop, value);
}

function arrayLengthSetHandler(target, value) {
  if (!isNumber(value)) throw new Error('bad argument. array length must be validate number.');
  const oldLen = target.length;
  if (oldLen > value) for(let i = value; i < oldLen; i++) {
    const v = target[i];
    isViewModel(v) && removeVMParent(v, target, i);
  }
  target.length = value;
  if (oldLen !== value) {
    target[VM_PARENTS].forEach(ps => notifyPropChanged(ps[0], ps[1]));
  }
  return true;
}

export const ObjectProxyHandler = {
  set: objectPropSetHandler
};

/**
 * functions need to be wrap.
 * if first bit is 1, it means this function return another Array need to be convert to ViewModel
 * if second bit is 1, it means this function will change array itself, need to notify change.
 */
const ArrayFns = {
  push: 2,
  pop: 2,
  shift: 2,
  unshift: 2,
  splice: 3,
  reverse: 2,
  sort: 2,
  fill: 2,
  filter: 1,
  slice: 1,
  concat: 1,
  map: 1
};

export const ArrayProxyHandler = {
  get(vm, prop) {
    if (prop in ArrayFns) {
      const tag = ArrayFns[prop];
      const fn = vm[prop];
      return function(...args) {
        const rtn = fn.call(vm, ...args);
        if ((tag & 2) > 0) {
          vm[VM_PARENTS].forEach(ps => notifyPropChanged(ps[0], ps[1]));
        }
        if ((tag & 1) > 0 && isArray(rtn) && !(VM_PARENTS in rtn)) {
          return wrapViewModel(rtn);
        } else {
          return rtn;
        }
      };
    } else {
      return vm[prop];
    }
  },
  set: arrayPropSetHandler
};


function wrapProp(vm, prop) {
  const v = vm[prop];
  if (v === null || typeOf(v) !== 'object' || VM_PARENTS in v) return;
  if (instanceOf(v, Boolean) || instanceOf(v, RegExp)) {
    v[VM_PARENTS] = VM_EMPTY_PARENTS;
    return;
  }
  vm[prop] = wrapViewModel(v);
  addVMParent(v, vm, prop);
}
function wrapProxy(vm, isArr, addMessengerInterface) {
  vm[VM_PARENTS] = [];
  if (addMessengerInterface) {
    vmAddMessengerInterface(vm);
  }
  return new Proxy(vm, isArr ? ArrayProxyHandler : ObjectProxyHandler);
}

export function wrapViewModel(plainObjectOrArray, addMessengerInterface = false) {
  if (plainObjectOrArray === null) return plainObjectOrArray;
  if (isObject(plainObjectOrArray)) {
    // already been ViewModel
    if (VM_PARENTS in plainObjectOrArray) return plainObjectOrArray;
    if (isComponent(plainObjectOrArray)) return wrapComponent(plainObjectOrArray);

    if (instanceOf(plainObjectOrArray, Boolean) || instanceOf(plainObjectOrArray, RegExp)) {
      plainObjectOrArray[VM_PARENTS] = VM_EMPTY_PARENTS;
    } else if (isArray(plainObjectOrArray)) {
      for(let i = 0; i < plainObjectOrArray.length; i++) {
        wrapProp(plainObjectOrArray, i);
      }
      return wrapProxy(plainObjectOrArray, true, addMessengerInterface);
    } else {
      for(const k in plainObjectOrArray) {
        if (isPublicProp(k)) {
          wrapProp(plainObjectOrArray, k);
        }
      }
      return wrapProxy(plainObjectOrArray, false, addMessengerInterface);
    }
  } else {
    return plainObjectOrArray;
  }
}

export function wrapComponent(component) {
  return new Proxy(component, ObjectProxyHandler);
}

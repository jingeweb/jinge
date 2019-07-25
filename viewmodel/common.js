import {
  isObject,
  isString,
  Symbol,
  startsWith
} from '../util';

export const VM_PARENTS = Symbol('vm_parents');
export const VM_DEBUG_ID = Symbol('vm_id');
export const VM_DEBUG_NAME = Symbol('vm_name');
export const VM_EMPTY_PARENTS = [];
export function isViewModel(obj) {
  return obj !== null && isObject(obj) && (VM_PARENTS in obj);
}

export function isPublicProp(v) {
  return isString(v) && !startsWith(v, '_');
}

export function addVMParent(vm, parent, prop) {
  const ps = vm[VM_PARENTS];
  for (let i = 0; i < ps.length; i++) {
    if (ps[i][0] === parent && ps[i][1] === prop) return;
  }
  ps.push([parent, prop]);
}

export function removeVMParent(vm, parent, prop) {
  const ps = vm[VM_PARENTS];
  for (let i = 0; i < ps.length; i++) {
    if (ps[i][0] === parent && ps[i][1] === prop) {
      ps.splice(i, 1);
      return;
    }
  }
}

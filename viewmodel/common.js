import {
  isObject,
  isString,
  Symbol,
  startsWith,
  instanceOf
} from '../util';

export const VM_PARENTS = Symbol('vm_parents');
export const VM_DESTROIED = Symbol('vm_destroied');
export const VM_DEBUG_ID = Symbol('vm_id');
export const VM_DEBUG_NAME = Symbol('vm_name');

export function isInnerObj(v) {
  return instanceOf(v, Boolean) || instanceOf(v, RegExp) || instanceOf(v, Date);
}
export function isViewModel(obj) {
  return isObject(obj) && !isInnerObj(obj) && (VM_PARENTS in obj);
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

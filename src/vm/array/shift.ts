import { isObject } from 'src/util';
import { GlobalViewModelWeakMap, VM_RAW, type ViewModelArray, addParent } from '../core';
import { notifyVmArrayChange } from '../watch';
import { removeArrayItemVmParent } from './helper';

export function arrayShift(targetViewModel: ViewModelArray, target: unknown[]) {
  if (target.length === 0) return undefined;
  const val = target.shift();
  const valVm = isObject(val) ? (val[VM_RAW] ? val : GlobalViewModelWeakMap.get(val)) : undefined;
  target.forEach((v, i) => {
    const vm = removeArrayItemVmParent(v, targetViewModel, i + 1);
    vm && addParent(vm, targetViewModel, i);
  });
  notifyVmArrayChange(targetViewModel);
  return valVm ?? val;
}

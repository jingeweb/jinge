import { type ViewModelArray, addParent } from '../core';
import { notifyVmArrayChange } from '../watch';
import { removeArrayItemVmParent } from './helper';

export function arrayShift(targetViewModel: ViewModelArray, target: unknown[]) {
  if (target.length === 0) return undefined;
  const val = target.shift();
  const valVm = removeArrayItemVmParent(val, targetViewModel, 0);
  target.forEach((v, i) => {
    const vm = removeArrayItemVmParent(v, targetViewModel, i + 1);
    vm && addParent(vm, targetViewModel, i);
  });
  notifyVmArrayChange(targetViewModel);
  return valVm ?? val;
}

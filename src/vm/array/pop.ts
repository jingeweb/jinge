import type { ViewModelArray } from '../core';
import { notifyVmArrayChange } from '../watch';
import { removeArrayItemVmParent } from './helper';

export function arrayPop(targetViewModel: ViewModelArray, target: unknown[]) {
  if (target.length === 0) {
    return undefined;
  }
  const val = target.pop();
  const valVm = removeArrayItemVmParent(val, targetViewModel, target.length);
  notifyVmArrayChange(targetViewModel);
  return valVm ?? val;
}

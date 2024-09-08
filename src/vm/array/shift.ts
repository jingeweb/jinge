import type { ViewModelArray } from '../core';
import { notifyVmArrayChange } from '../watch';
import { moveArrayItemsVmParentIndex, removeArrayItemVmParent } from './helper';

export function arrayShift(targetViewModel: ViewModelArray, target: unknown[]) {
  const len = target.length;
  if (len === 0) return undefined;

  const val = target[0];
  const valVm = removeArrayItemVmParent(val, targetViewModel, 0);
  len > 1 && moveArrayItemsVmParentIndex(target, targetViewModel, -1, 1, len - 1);
  target.shift();
  notifyVmArrayChange(targetViewModel);
  return valVm ?? val;
}

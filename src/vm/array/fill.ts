import { type AnyObj, isUndefined } from '../../util';
import { type ViewModelArray, addParent, shouldBeVm } from '../core';
import { getVmAndRaw } from '../object';
import { wrapViewModel } from '../proxy';
import { notifyVmArrayChange } from '../watch';
import { normalizeArrayIndex, removeArrayItemVmParent } from './helper';

export function arrayFill(
  targetViewModel: ViewModelArray,
  target: unknown[],
  v: unknown,
  start?: number,
  end?: number,
) {
  const len = target.length;
  if (len === 0) return targetViewModel;
  start = normalizeArrayIndex(isUndefined(start) ? 0 : start, len);
  end = normalizeArrayIndex(isUndefined(end) ? len : end, len);
  if (end <= start) return targetViewModel;

  const result = getVmAndRaw(v);
  let vm = result[0];
  if (!vm && shouldBeVm(v)) vm = wrapViewModel(v as AnyObj);
  const rawVal = result[1];
  for (let i = start; i < end; i++) {
    removeArrayItemVmParent(target[i], targetViewModel, i);
    if (vm) {
      addParent(vm, targetViewModel, i);
    }
    target[i] = rawVal;
  }

  notifyVmArrayChange(targetViewModel);
  return targetViewModel;
}

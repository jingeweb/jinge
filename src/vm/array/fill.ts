import { type AnyObj, isUndefined } from '../../util';
import { type ViewModelArray, addParent, shouldBeVm } from '../core';
import { wrapViewModel } from '../proxy';
import { removeArrayItemVmParent } from './helper';
import { getVmAndRaw } from '../object';

export function arrayFill(
  targetViewModel: ViewModelArray,
  target: unknown[],
  v: unknown,
  start?: number,
  end?: number,
) {
  const len = target.length;
  if (len === 0) return targetViewModel;
  if (isUndefined(start)) start = 0;
  if (isUndefined(end)) end = target.length;
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

  return targetViewModel;
}

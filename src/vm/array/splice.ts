import { wrapViewModelArr } from '.';
import { VM_RAW, type ViewModelArray, addParent, shouldBeVm } from '../core';
import { getVmAndRaw } from '../object';
import { wrapViewModel } from '../proxy';
import { notifyVmArrayChange } from '../watch';
import {
  moveArrayItemsVmParentIndex,
  normalizeArrayIndex,
  removeArrayItemVmParent,
} from './helper';
import { arrayPush } from './push';

export function arraySplice(
  targetViewModel: ViewModelArray,
  target: unknown[],
  idx?: number,
  delCount?: number,
  ...args: unknown[]
) {
  const len = target.length;
  const argumentCount = arguments.length - 2;
  idx = normalizeArrayIndex(idx ?? 0, len);
  delCount =
    argumentCount === 1
      ? len - idx
      : Math.min(Math.max(Math.trunc(delCount ?? 0) || 0, 0), len - idx);
  if (delCount === 0 && args.length === 0) return wrapViewModelArr([]);
  if (len === 0) {
    if (args.length > 0) {
      arrayPush(targetViewModel, target, ...args);
    }
    return wrapViewModelArr([]);
  }
  const delArr: unknown[] = [];
  const delArrVm = wrapViewModelArr(delArr);
  if (delCount > 0) {
    for (let i = idx; i < idx + delCount; i++) {
      const v = target[i];
      const vm = removeArrayItemVmParent(v, targetViewModel, i);
      delArr.push(vm ? vm[VM_RAW] : v);
      if (vm) addParent(vm, delArrVm, i - idx);
    }
  }
  const delta = args.length - delCount;
  if (delta !== 0) {
    moveArrayItemsVmParentIndex(target, targetViewModel, delta, idx + delCount, len - 1);
  }

  target.splice(idx, delCount);

  args.forEach((arg, i) => {
    const [valVm, rawVal] = getVmAndRaw(arg);
    const index = idx + i;
    if (valVm) {
      addParent(valVm, targetViewModel, index);
    } else if (shouldBeVm(arg)) {
      addParent(wrapViewModel(arg), targetViewModel, index);
    }
    target.splice(index, 0, rawVal);
  });

  notifyVmArrayChange(targetViewModel);
  return delArrVm;
}

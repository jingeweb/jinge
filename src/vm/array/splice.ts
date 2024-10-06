import { isUndefined } from '../../util';
import { VM_RAW, type ViewModelArray, addParent, shouldBeVm } from '../core';
import { arrayPush } from './push';
import { wrapViewModelArr } from '.';
import { moveArrayItemsVmParentIndex, removeArrayItemVmParent } from './helper';
import { wrapViewModel } from '../proxy';
import { getVmAndRaw } from '../object';
import { notifyVmArrayChange } from '../watch';

export function arraySplice(
  targetViewModel: ViewModelArray,
  target: unknown[],
  idx: number | undefined,
  delCount: number | undefined,
  ...args: unknown[]
) {
  if (isUndefined(idx)) idx = 0;
  if (isUndefined(delCount)) delCount = 0;
  if (delCount === 0 && args.length === 0) return wrapViewModelArr([]);
  const len = target.length;
  if (len === 0) {
    if (args.length > 0) {
      arrayPush(targetViewModel, target, ...args);
      notifyVmArrayChange(targetViewModel);
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
      vm && addParent(vm, delArrVm, i - idx);
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

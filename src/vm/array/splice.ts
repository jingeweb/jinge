import { isUndefined } from 'src/util';
import { VM_RAW, type ViewModelArray, addParent, shouldBeVm } from '../core';
import { arrayPush } from './push';
import { wrapViewModelArr } from '.';
import { removeArrayItemVmParent } from './helper';
import { wrapViewModel } from '../proxy';
import { getVmAndRaw } from '../object';

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
  const delta = delCount - args.length;
  if (delta !== 0) {
    for (let i = idx + delCount; i < len; i++) {
      const vm = removeArrayItemVmParent(target[i], targetViewModel, i);
      vm && addParent(vm, targetViewModel, i - delta);
    }
  }

  target.splice(idx, delCount);

  args.forEach((arg, i) => {
    const [valVm, rawVal] = getVmAndRaw(arg);
    console.log(valVm, rawVal);
    const index = idx + i;
    if (valVm) {
      addParent(valVm, targetViewModel, index);
    } else if (shouldBeVm(arg)) {
      addParent(wrapViewModel(arg), targetViewModel, index);
    }
    target.splice(index, 0, rawVal);
  });

  return delArrVm;
}

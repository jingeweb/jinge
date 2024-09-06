import { isUndefined } from 'src/util';
import {
  GlobalViewModelWeakMap,
  VM_RAW,
  type ViewModelArray,
  addParent,
  shouldBeVm,
} from '../core';
import { arrayPush } from './push';
import { wrapViewModelArr } from '.';
import { removeArrayItemVmParent } from './helper';
import { wrapViewModel } from '../proxy';

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
    if (shouldBeVm(arg)) {
      let viewModel = arg[VM_RAW] ? arg : GlobalViewModelWeakMap.get(arg);
      if (viewModel) {
        target.splice(idx, 0, viewModel[VM_RAW]);
      } else {
        viewModel = wrapViewModel(arg);
        target.splice(idx, 0, arg);
      }
      addParent(viewModel, targetViewModel, idx + i);
    } else {
      target.push(arg);
    }
  });

  return delArrVm;
}

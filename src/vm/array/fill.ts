import { isUndefined } from 'src/util';
import {
  GlobalViewModelWeakMap,
  VM_RAW,
  type ViewModelArray,
  addParent,
  shouldBeVm,
} from '../core';
import { wrapViewModel } from '../proxy';
import { removeArrayItemVmParent } from './helper';

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

  if (shouldBeVm(v)) {
    let newVm = v[VM_RAW] ? v : GlobalViewModelWeakMap.get(v);
    const newRawV = newVm ? v[VM_RAW] : v;
    if (!newVm) newVm = wrapViewModel(v);
    for (let i = start; i < end; i++) {
      removeArrayItemVmParent(target[i], targetViewModel, i);
      target[i] = newRawV;
      addParent(newVm, targetViewModel, i);
    }
  } else {
    for (let i = start; i < end; i++) {
      removeArrayItemVmParent(target[1], targetViewModel, i);
      target[i] = v;
    }
  }
  return targetViewModel;
}

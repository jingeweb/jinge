import { type AnyFn, isObject } from '../../util';
import {
  GlobalViewModelWeakMap,
  VM_RAW,
  type ViewModel,
  type ViewModelArray,
  addParent,
} from '../core';
import { notifyVmArrayChange } from '../watch';
import { removeArrayItemVmParent } from './helper';

export function arrayReverse(targetViewModel: ViewModelArray, target: unknown[]) {
  const len = target.length;
  if (len <= 1) return targetViewModel;
  const it0 = target[0];
  removeArrayItemVmParent(it0, targetViewModel, 0);
  const mid = len >> 1;
  for (let i = 0; i < mid; i++) {
    const i2 = len - 1 - i;
    const vm = removeArrayItemVmParent(target[i], targetViewModel, i);
    const vm2 = removeArrayItemVmParent(target[i2], targetViewModel, i2);
    const tmp = target[i];
    target[i] = target[i2];
    target[i2] = tmp;
    vm && addParent(vm, targetViewModel, i2);
    vm2 && addParent(vm2, targetViewModel, i);
  }

  notifyVmArrayChange(targetViewModel);
  return targetViewModel;
}

export function arraySort(targetViewModel: ViewModelArray, target: unknown[], fn?: AnyFn) {
  if (target.length <= 1) return targetViewModel;
  target.forEach((v, i) => {
    removeArrayItemVmParent(v, targetViewModel, i);
  });
  target.sort(fn);
  target.forEach((v, i) => {
    if (isObject(v)) {
      const vm = v[VM_RAW] ? (v as ViewModel) : GlobalViewModelWeakMap.get(v);
      vm && addParent(vm, targetViewModel, i);
    }
  });
  notifyVmArrayChange(targetViewModel);
  return targetViewModel;
}
